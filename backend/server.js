const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// ── Load config before anything else ──────────────────────────────
dotenv.config();

const connectDB = require('./config/db');
const { redis, createPubClient, createSubClient } = require('./config/redis');

// Models
const Message = require('./models/Message');
const Conversation = require('./models/Conversation');

// Middleware
const {
  helmetMiddleware,
  mongoSanitizeMiddleware,
  hppMiddleware,
  compressionMiddleware,
  xssSanitize,
  getCorsOptions,
} = require('./middleware/security');
const { globalLimiter } = require('./middleware/rateLimiter');
const { checkSocketRateLimit, cleanupSocketRateLimit } = require('./middleware/rateLimiter');

// Services
const presenceService = require('./services/presenceService');
const notificationService = require('./services/notificationService');
const feedScoreService = require('./services/feedScoreService');
const eventBus = require('./services/eventBus');
// Initialize analytics service (starts listening to events)
require('./services/analyticsService');

// ── Connect to MongoDB ────────────────────────────────────────────
connectDB();

const app = express();
const server = http.createServer(app);

// ─── Socket.IO Setup with Redis Adapter ───────────────────────────
let io;
try {
  const { createAdapter } = require('@socket.io/redis-adapter');
  const pubClient = createPubClient();
  const subClient = createSubClient();

  io = new Server(server, {
    cors: getCorsOptions(),
    pingInterval: 25000,
    pingTimeout: 20000,
    maxHttpBufferSize: 1e6, // 1MB max message size
  });

  // Use Redis adapter for horizontal scaling
  Promise.all([
    new Promise((resolve) => pubClient.on('connect', resolve)),
    new Promise((resolve) => subClient.on('connect', resolve)),
  ]).then(() => {
    io.adapter(createAdapter(pubClient, subClient));
    console.log('🔌 Socket.IO Redis adapter connected');
  }).catch((err) => {
    console.warn('⚠️ Socket.IO Redis adapter failed, using in-memory:', err.message);
  });
} catch (err) {
  console.warn('⚠️ Redis adapter not available, using in-memory Socket.IO');
  io = new Server(server, {
    cors: getCorsOptions(),
    pingInterval: 25000,
    pingTimeout: 20000,
  });
}

// Inject Socket.IO into notification service
notificationService.setIO(io);

// ─── Express Middleware Stack (ORDER MATTERS) ─────────────────────
// 1. Secure HTTP headers
app.use(helmetMiddleware);

// 2. CORS
app.use(cors(getCorsOptions()));

// 3. NoSQL injection prevention
app.use(mongoSanitizeMiddleware);

// 4. XSS sanitization
app.use(xssSanitize);

// 5. HTTP parameter pollution prevention
app.use(hppMiddleware);

// 6. Response compression (gzip level 6)
app.use(compressionMiddleware);

// 7. Global rate limiting (100 req/min per IP)
app.use(globalLimiter);

// 8. Body parsing (reduced from 1MB to 256KB)
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false, limit: '256kb' }));

// 9. Request logging (development only)
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

// ─── Routes ───────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/users', require('./routes/users'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/notifications', require('./routes/notifications'));

// Health check
app.get('/api/health', async (_, res) => {
  let redisOk = false;
  try {
    await redis.ping();
    redisOk = true;
  } catch {}

  res.json({
    status: 'OK',
    timestamp: new Date(),
    redis: redisOk ? 'connected' : 'disconnected',
    uptime: process.uptime(),
  });
});

// 404 handler
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: err.message || 'Server Error' });
});

// ─── Socket.IO Authentication Middleware ──────────────────────────
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    socket.deviceInfo = socket.handshake.auth?.deviceInfo || 'unknown';
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new Error('Token expired'));
    }
    next(new Error('Invalid token'));
  }
});

// ─── Socket.IO Connection Handler ─────────────────────────────────
io.on('connection', async (socket) => {
  const userId = socket.userId;
  console.log(`⚡ User connected: ${userId} (socket: ${socket.id})`);

  // ── Register presence in Redis ────────────────────────────
  const wasAlreadyOnline = await presenceService.connect(userId, socket.id, {
    deviceInfo: socket.deviceInfo,
    processId: process.pid,
  });

  // Join user's personal room for direct targeting
  socket.join(userId);

  // Broadcast online status (only if this is a new online event)
  if (!wasAlreadyOnline) {
    const deviceCount = await presenceService.getDeviceCount(userId);
    socket.broadcast.emit('user_online', { userId, deviceCount });
  }

  // ── Deliver offline messages ────────────────────────────────
  try {
    const offlineKey = `offline:msgs:${userId}`;
    const offlineMessages = await redis.lrange(offlineKey, 0, -1);
    if (offlineMessages.length > 0) {
      for (const msgData of offlineMessages) {
        try {
          const { serverId, conversationId } = JSON.parse(msgData);
          const message = await Message.findById(serverId).populate('sender', 'username avatar');
          if (message) {
            socket.emit('new_message', { ...message.toObject(), isOfflineDelivery: true });
          }
        } catch {}
      }
      await redis.del(offlineKey);
      console.log(`📬 Delivered ${offlineMessages.length} offline messages to ${userId}`);
    }
  } catch {
    // Redis unavailable — skip offline delivery
  }

  // ── Heartbeat for presence tracking ─────────────────────────
  socket.on('heartbeat', async () => {
    if (checkSocketRateLimit(socket.id, 5, 60000)) return; // Max 5 heartbeats/min
    await presenceService.heartbeat(userId);
  });

  // ── Presence query (batch check online status) ──────────────
  socket.on('presence_query', async ({ userIds }) => {
    if (checkSocketRateLimit(socket.id)) return;
    if (!Array.isArray(userIds) || userIds.length > 50) return;

    const statuses = await presenceService.getPresenceBatch(userIds);
    socket.emit('presence_result', { statuses });
  });

  // ── Join a conversation room ────────────────────────────────
  socket.on('join_conversation', async (conversationId) => {
    if (checkSocketRateLimit(socket.id)) return;
    try {
      const conv = await Conversation.findById(conversationId);
      if (conv && conv.participants.map(String).includes(userId)) {
        socket.join(`conv_${conversationId}`);

        // Update read cursor to latest seqNum
        if (conv.seqCounter > 0) {
          const currentCursor = conv.readCursors?.get(userId) || 0;
          if (conv.seqCounter > currentCursor) {
            await Conversation.findByIdAndUpdate(conversationId, {
              [`readCursors.${userId}`]: conv.seqCounter,
            });
          }
        }

        // Notify the other user that messages were seen
        const otherUserId = conv.participants.find((p) => p.toString() !== userId);
        if (otherUserId) {
          io.to(otherUserId.toString()).emit('messages_read', {
            conversationId,
            upToSeqNum: conv.seqCounter,
          });
        }
      }
    } catch (err) {
      console.error('join_conversation error:', err.message);
    }
  });

  // ── Leave a conversation room ───────────────────────────────
  socket.on('leave_conversation', (conversationId) => {
    socket.leave(`conv_${conversationId}`);
  });

  // ── Send encrypted message via socket ───────────────────────
  socket.on('send_message', async (data) => {
    if (checkSocketRateLimit(socket.id)) {
      socket.emit('error', { message: 'Rate limit exceeded' });
      return;
    }

    try {
      const { conversationId, ciphertext, iv, clientMsgId } = data;
      if (!conversationId || !ciphertext || !iv) return;

      const msgId = clientMsgId || uuidv4();

      const conv = await Conversation.findById(conversationId);
      if (!conv || !conv.participants.map(String).includes(userId)) return;

      // ── Idempotency check ─────────────────────────────────
      try {
        const idempotencyKey = `chat:idempotency:${msgId}`;
        const existing = await redis.get(idempotencyKey);
        if (existing) {
          const existingMsg = await Message.findById(existing).populate('sender', 'username avatar');
          if (existingMsg) {
            socket.emit('message_ack', {
              clientMsgId: msgId,
              serverId: existingMsg._id,
              seqNum: existingMsg.seqNum,
              status: existingMsg.status,
              deduplicated: true,
            });
            return;
          }
        }
      } catch {}

      // ── Atomically assign sequence number ──────────────────
      const updated = await Conversation.findByIdAndUpdate(
        conversationId,
        { $inc: { seqCounter: 1 } },
        { new: true }
      );
      const seqNum = updated.seqCounter;

      // ── Save encrypted message to DB ───────────────────────
      let message;
      try {
        message = await Message.create({
          conversation: conversationId,
          sender: userId,
          ciphertext,
          iv,
          clientMsgId: msgId,
          seqNum,
          status: 'sent',
        });
      } catch (err) {
        if (err.code === 11000) {
          // Duplicate clientMsgId — return existing
          const dup = await Message.findOne({ clientMsgId: msgId }).populate('sender', 'username avatar');
          if (dup) {
            socket.emit('message_ack', {
              clientMsgId: msgId,
              serverId: dup._id,
              seqNum: dup.seqNum,
              status: dup.status,
              deduplicated: true,
            });
          }
          return;
        }
        throw err;
      }

      // Store idempotency key
      try {
        await redis.set(`chat:idempotency:${msgId}`, message._id.toString(), 'EX', 3600);
      } catch {}

      // Update conversation metadata
      conv.lastMessage = '[Encrypted]';
      conv.lastMessageAt = new Date();
      await conv.save();

      const populated = await Message.findById(message._id).populate('sender', 'username avatar');

      // ── ACK to sender ──────────────────────────────────────
      socket.emit('message_ack', {
        clientMsgId: msgId,
        serverId: message._id,
        seqNum,
        status: 'sent',
      });

      // ── Deliver to recipient ───────────────────────────────
      const otherUserId = conv.participants.find((p) => p.toString() !== userId);
      if (otherUserId) {
        const recipientStr = otherUserId.toString();
        const isRecipientOnline = await presenceService.isOnline(recipientStr);

        // Send to conversation room (if recipient is in it)
        socket.to(`conv_${conversationId}`).emit('new_message', {
          ...populated.toObject(),
          seqNum,
        });

        if (isRecipientOnline) {
          // Recipient is online — also send notification badge
          io.to(recipientStr).emit('message_notification', {
            conversationId,
            message: populated,
          });
        } else {
          // Recipient offline — queue for later delivery
          try {
            const offlineKey = `offline:msgs:${recipientStr}`;
            await redis.lpush(offlineKey, JSON.stringify({
              serverId: message._id.toString(),
              conversationId,
            }));
            // TTL matches message TTL (7 days)
            await redis.expire(offlineKey, 7 * 24 * 60 * 60);
            // Cap at 1000 entries
            await redis.ltrim(offlineKey, 0, 999);
          } catch {}
        }
      }

      // Emit event for analytics
      eventBus.emitEvent('activity', {
        type: 'message_sent',
        userId,
        targetId: conversationId,
        timestamp: Date.now(),
      });
    } catch (err) {
      console.error('send_message error:', err.message);
    }
  });

  // ── Message delivery acknowledgment ─────────────────────────
  socket.on('message_delivered', async ({ serverId }) => {
    if (checkSocketRateLimit(socket.id)) return;
    try {
      const message = await Message.findByIdAndUpdate(
        serverId,
        { status: 'delivered', deliveredAt: new Date() },
        { new: true }
      );
      if (message) {
        // Notify sender that message was delivered
        io.to(message.sender.toString()).emit('message_status', {
          serverId,
          conversationId: message.conversation.toString(),
          status: 'delivered',
        });
      }
    } catch {}
  });

  // ── Mark messages as seen ───────────────────────────────────
  socket.on('messages_seen', async ({ conversationId, upToSeqNum }) => {
    if (checkSocketRateLimit(socket.id)) return;
    try {
      // Batch update all messages up to seqNum
      await Message.updateMany(
        {
          conversation: conversationId,
          sender: { $ne: userId },
          seqNum: { $lte: upToSeqNum },
          status: { $ne: 'seen' },
        },
        { status: 'seen', seenAt: new Date() }
      );

      // Update read cursor
      await Conversation.findByIdAndUpdate(conversationId, {
        [`readCursors.${userId}`]: upToSeqNum,
      });

      // Notify sender
      const conv = await Conversation.findById(conversationId);
      const otherUserId = conv?.participants.find((p) => p.toString() !== userId);
      if (otherUserId) {
        io.to(otherUserId.toString()).emit('message_status', {
          conversationId,
          status: 'seen',
          upToSeqNum,
        });
      }
    } catch {}
  });

  // ── Sync request (reconnection — fetch missed messages) ─────
  socket.on('sync_request', async ({ conversationId, lastSeqNum }) => {
    if (checkSocketRateLimit(socket.id)) return;
    try {
      const conv = await Conversation.findById(conversationId);
      if (!conv || !conv.participants.map(String).includes(userId)) return;

      const messages = await Message.find({
        conversation: conversationId,
        seqNum: { $gt: lastSeqNum },
      })
        .sort({ seqNum: 1 })
        .limit(100)
        .populate('sender', 'username avatar');

      const hasMore = await Message.countDocuments({
        conversation: conversationId,
        seqNum: { $gt: lastSeqNum },
      }) > 100;

      socket.emit('sync_response', {
        conversationId,
        messages,
        hasMore,
      });
    } catch {}
  });

  // ── Typing indicator ────────────────────────────────────────
  socket.on('typing', ({ conversationId, isTyping }) => {
    if (checkSocketRateLimit(socket.id, 20, 60000)) return; // Max 20 typing events/min
    socket.to(`conv_${conversationId}`).emit('user_typing', {
      conversationId,
      userId,
      isTyping,
    });
  });

  // ── Notification: mark as read via socket ───────────────────
  socket.on('mark_notifications_read', async ({ notificationIds, all }) => {
    if (checkSocketRateLimit(socket.id)) return;
    try {
      if (all) {
        await notificationService.markAllAsRead(userId);
      } else if (Array.isArray(notificationIds)) {
        await notificationService.markAsRead(userId, notificationIds);
      }
      const count = await notificationService.getUnreadCount(userId);
      socket.emit('notification_count', { unreadCount: count });
    } catch {}
  });

  // ── Disconnect ──────────────────────────────────────────────
  socket.on('disconnect', async () => {
    console.log(`🔌 User disconnected: ${userId} (socket: ${socket.id})`);
    cleanupSocketRateLimit(socket.id);

    const isFullyOffline = await presenceService.disconnect(userId, socket.id);
    if (isFullyOffline) {
      const lastSeen = new Date().toISOString();
      socket.broadcast.emit('user_offline', { userId, lastSeen });
    }
  });
});

// ─── Periodic Jobs ────────────────────────────────────────────────

// Zombie connection cleanup (every 60s)
setInterval(async () => {
  try {
    const staleUsers = await presenceService.cleanupStale();
    if (staleUsers.length > 0) {
      for (const userId of staleUsers) {
        io.emit('user_offline', { userId, lastSeen: new Date().toISOString() });
      }
    }
  } catch {}
}, 60000);

// Feed score recalculation (every 5 minutes)
setInterval(async () => {
  try {
    await feedScoreService.recalculateBatch(48);
  } catch (err) {
    console.error('Feed score recalculation error:', err.message);
  }
}, 5 * 60 * 1000);

// ─── Graceful Shutdown ────────────────────────────────────────────
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);

  // Stop accepting new connections
  server.close(() => console.log('HTTP server closed'));

  // Close Socket.IO
  io.close(() => console.log('Socket.IO closed'));

  // Disconnect Redis
  try {
    const { disconnectRedis } = require('./config/redis');
    await disconnectRedis();
  } catch {}

  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ─── Start Server ─────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔐 Security: Helmet + CORS + Sanitize + Rate Limiting`);
  console.log(`📡 Real-time: Socket.IO with Redis adapter`);
  console.log(`🤖 Moderation: Hybrid sync + async pipeline`);
  console.log(`📊 Feed: Smart ranking with engagement scoring\n`);
});
