const { v4: uuidv4 } = require('uuid');
const Chatroom = require('../models/Chatroom');
const { redis } = require('../config/redis');

// ─── Chatroom Service ─────────────────────────────────────────────
// Core business logic for ephemeral chatrooms.
//
// Delivery model: AT-MOST-ONCE
//   Messages are broadcast via Socket.IO with no ack/retry.
//   Clients deduplicate by seqId. No message is ever persisted to MongoDB.
//
// Redis key prefix: cr:
//   cr:msgs:{roomId}                → List   (ephemeral message buffer, cap 200)
//   cr:participants:{roomId}        → Set    (userId members)
//   cr:nicknames:{roomId}           → Hash   (userId → displayName)
//   cr:seq:{roomId}                 → Counter (atomic message ordering)
//   cr:code:{code}                  → String (room code reservation, SET NX)
//   cr:user_rooms:{userId}          → Set    (reverse index for reconnect)
//   cr:room_sockets:{roomId}:{uid}  → Set    (socketIds per user for multi-tab)

// ── Anonymous Name Generator ─────────────────────────────────────
const ADJECTIVES = [
  'Curious', 'Silent', 'Brave', 'Witty', 'Cosmic', 'Mystic', 'Neon',
  'Shadow', 'Crystal', 'Velvet', 'Crimson', 'Golden', 'Phantom', 'Swift',
  'Lucky', 'Stormy', 'Fuzzy', 'Sneaky', 'Jolly', 'Spooky',
];
const ANIMALS = [
  'Panda', 'Fox', 'Owl', 'Wolf', 'Falcon', 'Dolphin', 'Tiger',
  'Raven', 'Phoenix', 'Lynx', 'Cobra', 'Hawk', 'Bear', 'Jaguar',
  'Otter', 'Badger', 'Heron', 'Mantis', 'Gecko', 'Crane',
];

function generateAnonName() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${adj} ${animal}`;
}

class ChatroomService {
  constructor() {
    this.redisAvailable = false;
    this._devMessageStore = process.env.NODE_ENV === 'development' ? new Map() : null;

    redis.ping()
      .then(() => { this.redisAvailable = true; })
      .catch(() => {});
    redis.on('connect', () => { this.redisAvailable = true; });
    redis.on('error', () => { this.redisAvailable = false; });
  }

  // ── Room CRUD ──────────────────────────────────────────────────

  async createRoom(userId, { name, type, maxParticipants = 50 }) {
    if (!this.redisAvailable && !this._devMessageStore) {
      throw new Error('REDIS_UNAVAILABLE');
    }

    const roomId = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    let code = null;
    if (type === 'private') {
      code = await this.generateUniqueCode(roomId);
    }

    const room = await Chatroom.create({
      roomId, name, type, code,
      status: 'created',
      createdBy: userId,
      maxParticipants: Math.min(Math.max(maxParticipants, 2), 50),
      expiresAt,
    });

    // Pre-set TTLs so keys auto-expire even if cleanup cron misses them
    const ttl = 24 * 60 * 60;
    if (this.redisAvailable) {
      const pipe = redis.pipeline();
      // Create empty keys so EXPIRE works
      pipe.sadd(`cr:participants:${roomId}`, '__init__');
      pipe.srem(`cr:participants:${roomId}`, '__init__');
      pipe.expire(`cr:participants:${roomId}`, ttl);
      pipe.expire(`cr:nicknames:${roomId}`, ttl);
      pipe.expire(`cr:seq:${roomId}`, ttl);
      pipe.expire(`cr:msgs:${roomId}`, ttl);
      await pipe.exec();
    }

    return room.toObject();
  }

  // ── Code Generation (atomic via Redis SET NX) ──────────────────

  async generateUniqueCode(roomId) {
    for (let attempt = 0; attempt < 20; attempt++) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const reserved = await redis.set(`cr:code:${code}`, roomId, 'EX', 86400, 'NX');
      if (reserved) return code;
    }
    throw new Error('CODE_GENERATION_FAILED');
  }

  // ── Join / Leave ───────────────────────────────────────────────

  async joinRoom(userId, roomId, socketId) {
    const room = await Chatroom.findOne({ roomId }).lean();

    // Gate 1: exists
    if (!room) throw new Error('ROOM_NOT_FOUND');

    // Gate 2: not expired (real-time check, not status field)
    if (room.expiresAt < new Date() || room.status === 'expired') {
      throw new Error('ROOM_EXPIRED');
    }

    // Gate 3: capacity (skip if user already in room — multi-tab)
    const isAlreadyIn = await redis.sismember(`cr:participants:${roomId}`, userId);
    if (!isAlreadyIn) {
      const count = await redis.scard(`cr:participants:${roomId}`);
      if (count >= room.maxParticipants) throw new Error('ROOM_FULL');
    }

    // Generate nickname if first join
    let nickname = await redis.hget(`cr:nicknames:${roomId}`, userId);
    if (!nickname) {
      nickname = generateAnonName();
      await redis.hset(`cr:nicknames:${roomId}`, userId, nickname);
    }

    // Add participant + track socket + reverse index (pipeline)
    const pipe = redis.pipeline();
    pipe.sadd(`cr:participants:${roomId}`, userId);
    pipe.sadd(`cr:room_sockets:${roomId}:${userId}`, socketId);
    pipe.sadd(`cr:user_rooms:${userId}`, roomId);
    // Refresh TTL on reverse index
    pipe.expire(`cr:user_rooms:${userId}`, 24 * 60 * 60);
    pipe.expire(`cr:room_sockets:${roomId}:${userId}`, 24 * 60 * 60);
    await pipe.exec();

    // Transition room status
    if (room.status === 'created' || room.status === 'idle') {
      await Chatroom.updateOne({ roomId }, { status: 'active', lastActivity: new Date() });
    }

    return { room, nickname, isNewParticipant: !isAlreadyIn };
  }

  async leaveRoom(userId, roomId) {
    const pipe = redis.pipeline();
    pipe.srem(`cr:participants:${roomId}`, userId);
    pipe.hdel(`cr:nicknames:${roomId}`, userId);
    pipe.srem(`cr:user_rooms:${userId}`, roomId);
    pipe.del(`cr:room_sockets:${roomId}:${userId}`);
    await pipe.exec();

    // If room now empty, mark expired
    const remaining = await redis.scard(`cr:participants:${roomId}`);
    if (remaining === 0) {
      await Chatroom.updateOne({ roomId }, { status: 'expired' });
    }
  }

  // Multi-tab: remove one socket, fully leave only when 0 sockets remain
  async handleSocketDisconnect(userId, roomId, socketId) {
    await redis.srem(`cr:room_sockets:${roomId}:${userId}`, socketId);
    const remaining = await redis.scard(`cr:room_sockets:${roomId}:${userId}`);

    if (remaining === 0) {
      // All tabs closed — fully leave
      await this.leaveRoom(userId, roomId);
      return true; // user fully left
    }
    return false; // still has other tabs
  }

  // ── Messages (ephemeral buffer, AT-MOST-ONCE) ─────────────────

  async storeMessage(roomId, message) {
    if (this.redisAvailable) {
      const pipe = redis.pipeline();
      pipe.rpush(`cr:msgs:${roomId}`, JSON.stringify(message));
      pipe.ltrim(`cr:msgs:${roomId}`, -200, -1);
      await pipe.exec();
    } else if (this._devMessageStore) {
      if (!this._devMessageStore.has(roomId)) this._devMessageStore.set(roomId, []);
      const msgs = this._devMessageStore.get(roomId);
      msgs.push(message);
      if (msgs.length > 200) msgs.splice(0, msgs.length - 200);
    } else {
      throw new Error('REDIS_UNAVAILABLE');
    }
  }

  async getRecentMessages(roomId, count = 50) {
    if (this.redisAvailable) {
      const raw = await redis.lrange(`cr:msgs:${roomId}`, -count, -1);
      return raw.map((r) => JSON.parse(r));
    } else if (this._devMessageStore) {
      return (this._devMessageStore.get(roomId) || []).slice(-count);
    }
    return [];
  }

  async getNextSeqId(roomId) {
    return await redis.incr(`cr:seq:${roomId}`);
  }

  // ── Queries ────────────────────────────────────────────────────

  async getParticipantCount(roomId) {
    return await redis.scard(`cr:participants:${roomId}`);
  }

  async getParticipants(roomId) {
    return await redis.smembers(`cr:participants:${roomId}`);
  }

  async getNickname(roomId, userId) {
    return (await redis.hget(`cr:nicknames:${roomId}`, userId)) || 'Anonymous';
  }

  async getPublicRooms(page = 1, limit = 12) {
    const skip = (page - 1) * limit;
    const query = {
      type: 'public',
      status: { $in: ['created', 'active', 'idle'] },
      expiresAt: { $gt: new Date() },
    };

    const [rooms, total] = await Promise.all([
      Chatroom.find(query).sort({ lastActivity: -1 }).skip(skip).limit(limit).lean(),
      Chatroom.countDocuments(query),
    ]);

    // Enrich with live Redis participant counts
    if (this.redisAvailable) {
      const pipe = redis.pipeline();
      rooms.forEach((r) => pipe.scard(`cr:participants:${r.roomId}`));
      const results = await pipe.exec();
      rooms.forEach((r, i) => { r.participantCount = results[i]?.[1] || 0; });
    }

    return { rooms, total, page, totalPages: Math.ceil(total / limit) };
  }

  async findByCode(code) {
    if (this.redisAvailable) {
      const roomId = await redis.get(`cr:code:${code}`);
      if (!roomId) return null;
      const room = await Chatroom.findOne({ roomId }).lean();
      if (!room || room.expiresAt < new Date()) return null;
      room.participantCount = await redis.scard(`cr:participants:${roomId}`);
      return room;
    }
    // Fallback: direct MongoDB lookup
    const room = await Chatroom.findOne({ code, expiresAt: { $gt: new Date() } }).lean();
    return room || null;
  }

  async getRoomByRoomId(roomId) {
    const room = await Chatroom.findOne({ roomId }).lean();
    if (!room) return null;
    room.participantCount = await this.getParticipantCount(roomId);
    return room;
  }

  // ── Lifecycle / Cleanup ────────────────────────────────────────

  async cleanupExpiredRooms(chatroomNs) {
    const expiredRooms = await Chatroom.find({
      $or: [
        { expiresAt: { $lte: new Date() } },
        { status: 'expired' },
      ],
    }).lean();

    let cleaned = 0;
    for (const room of expiredRooms) {
      try {
        // 1. Notify & disconnect all sockets
        if (chatroomNs) {
          chatroomNs.to(room.roomId).emit('chatroom:room_expired', {
            roomId: room.roomId,
            reason: 'Room has expired',
            redirectTo: '/chatrooms',
          });
          chatroomNs.in(room.roomId).socketsLeave(room.roomId);
        }

        // 2. Get participants for reverse-index cleanup
        const participants = await redis.smembers(`cr:participants:${room.roomId}`);

        // 3. Pipeline delete ALL Redis keys for this room
        const pipe = redis.pipeline();
        pipe.del(`cr:msgs:${room.roomId}`);
        pipe.del(`cr:participants:${room.roomId}`);
        pipe.del(`cr:nicknames:${room.roomId}`);
        pipe.del(`cr:seq:${room.roomId}`);
        if (room.code) pipe.del(`cr:code:${room.code}`);
        for (const uid of participants) {
          pipe.srem(`cr:user_rooms:${uid}`, room.roomId);
          pipe.del(`cr:room_sockets:${room.roomId}:${uid}`);
        }
        await pipe.exec();

        // 4. Delete MongoDB doc
        await Chatroom.deleteOne({ _id: room._id });
        cleaned++;
      } catch (err) {
        console.error(`Chatroom cleanup error for ${room.roomId}:`, err.message);
      }
    }

    if (cleaned > 0) console.log(`🧹 Cleaned ${cleaned} expired chatrooms`);
    return cleaned;
  }

  async closeRoom(roomId, userId, chatroomNs) {
    const room = await Chatroom.findOne({ roomId });
    if (!room) throw new Error('ROOM_NOT_FOUND');
    if (room.createdBy.toString() !== userId) throw new Error('NOT_ROOM_CREATOR');

    // Notify connected users
    if (chatroomNs) {
      chatroomNs.to(roomId).emit('chatroom:room_closed', {
        roomId,
        reason: 'Room closed by creator',
      });
      chatroomNs.in(roomId).socketsLeave(roomId);
    }

    // Cleanup Redis
    const participants = await redis.smembers(`cr:participants:${roomId}`);
    const pipe = redis.pipeline();
    pipe.del(`cr:msgs:${roomId}`);
    pipe.del(`cr:participants:${roomId}`);
    pipe.del(`cr:nicknames:${roomId}`);
    pipe.del(`cr:seq:${roomId}`);
    if (room.code) pipe.del(`cr:code:${room.code}`);
    for (const uid of participants) {
      pipe.srem(`cr:user_rooms:${uid}`, roomId);
      pipe.del(`cr:room_sockets:${roomId}:${uid}`);
    }
    await pipe.exec();

    await Chatroom.deleteOne({ _id: room._id });
  }
}

module.exports = new ChatroomService();
