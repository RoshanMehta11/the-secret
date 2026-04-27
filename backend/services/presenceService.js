const { redis, isRedisAvailable } = require('../config/redis');

// ─── Presence Service ─────────────────────────────────────────────
// Manages online user presence using Redis data structures:
//   - Sorted Set `presence:online` → {userId: lastHeartbeat}
//   - Hash `user:sessions:{userId}` → {socketId: metadata}
//   - String `user:last_seen:{userId}` → ISO timestamp (TTL 30d)
//
// GRACEFUL DEGRADATION: All methods return safe defaults when Redis
// is unavailable, so the server never crashes.

const KEYS = {
  ONLINE: 'presence:online',
  SESSION: (userId) => `user:sessions:${userId}`,
  LAST_SEEN: (userId) => `user:last_seen:${userId}`,
  STALE_LOCK: 'presence:stale_check_lock',
};

const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const STALE_THRESHOLD = 90000;    // 90 seconds (missed 3 heartbeats)
const LAST_SEEN_TTL = 30 * 24 * 60 * 60; // 30 days in seconds

class PresenceService {
  /**
   * Register a user connection
   * @param {string} userId
   * @param {string} socketId
   * @param {object} metadata - { deviceInfo, processId }
   * @returns {boolean} wasAlreadyOnline — true if user had existing sessions
   */
  async connect(userId, socketId, metadata = {}) {
    try {
      const sessionKey = KEYS.SESSION(userId);
      const sessionData = JSON.stringify({
        ...metadata,
        connectedAt: new Date().toISOString(),
      });

      const pipeline = redis.pipeline();

      // Add socket to user's session hash
      pipeline.hset(sessionKey, socketId, sessionData);

      // Update presence sorted set with current timestamp
      pipeline.zadd(KEYS.ONLINE, Date.now(), userId);

      // Remove last_seen (user is now online)
      pipeline.del(KEYS.LAST_SEEN(userId));

      await pipeline.exec();

      // Check if this is a new online event (user had no prior sessions)
      const sessionCount = await redis.hlen(sessionKey);
      return sessionCount > 1; // true = was already online
    } catch (err) {
      console.warn('PresenceService.connect error:', err.message);
      return false;
    }
  }

  /**
   * Handle user disconnection
   * @param {string} userId
   * @param {string} socketId
   * @returns {boolean} isFullyOffline — true if no more sessions remain
   */
  async disconnect(userId, socketId) {
    try {
      const sessionKey = KEYS.SESSION(userId);

      // Remove this socket from user's sessions
      await redis.hdel(sessionKey, socketId);

      // Check remaining sessions
      const remaining = await redis.hlen(sessionKey);

      if (remaining === 0) {
        // User is truly offline
        const pipeline = redis.pipeline();
        pipeline.zrem(KEYS.ONLINE, userId);
        pipeline.set(KEYS.LAST_SEEN(userId), new Date().toISOString(), 'EX', LAST_SEEN_TTL);
        pipeline.del(sessionKey);
        await pipeline.exec();
        return true; // Fully offline
      }

      return false; // Still has other sessions
    } catch (err) {
      console.warn('PresenceService.disconnect error:', err.message);
      return true; // Assume offline on error
    }
  }

  /**
   * Update heartbeat timestamp for a user
   * @param {string} userId
   */
  async heartbeat(userId) {
    try {
      await redis.zadd(KEYS.ONLINE, Date.now(), userId);
    } catch {}
  }

  /**
   * Check if a user is online
   * @param {string} userId
   * @returns {boolean}
   */
  async isOnline(userId) {
    try {
      const score = await redis.zscore(KEYS.ONLINE, userId);
      return score !== null;
    } catch {
      return false;
    }
  }

  /**
   * Batch check online status for multiple users
   * @param {string[]} userIds
   * @returns {object} { userId: { online, lastSeen } }
   */
  async getPresenceBatch(userIds) {
    const result = {};
    try {
      const pipeline = redis.pipeline();

      for (const uid of userIds) {
        pipeline.zscore(KEYS.ONLINE, uid);
        pipeline.get(KEYS.LAST_SEEN(uid));
      }

      const responses = await pipeline.exec();

      for (let i = 0; i < userIds.length; i++) {
        const onlineScore = responses[i * 2]?.[1];
        const lastSeen = responses[i * 2 + 1]?.[1];

        result[userIds[i]] = {
          online: onlineScore !== null,
          lastSeen: lastSeen || null,
        };
      }
    } catch {
      // Return all offline on error
      for (const uid of userIds) {
        result[uid] = { online: false, lastSeen: null };
      }
    }

    return result;
  }

  /**
   * Get all online user IDs
   * @returns {string[]}
   */
  async getOnlineUsers() {
    try {
      return await redis.zrange(KEYS.ONLINE, 0, -1);
    } catch {
      return [];
    }
  }

  /**
   * Get device count for a user
   * @param {string} userId
   * @returns {number}
   */
  async getDeviceCount(userId) {
    try {
      return await redis.hlen(KEYS.SESSION(userId));
    } catch {
      return 0;
    }
  }

  /**
   * Clean up stale connections (zombie cleanup)
   * Should be called by a periodic job (every 60s)
   */
  async cleanupStale() {
    try {
      // Distributed lock to prevent multiple processes running cleanup
      const lockAcquired = await redis.set(KEYS.STALE_LOCK, '1', 'EX', 55, 'NX');
      if (!lockAcquired) return [];

      const threshold = Date.now() - STALE_THRESHOLD;
      const staleUserIds = await redis.zrangebyscore(KEYS.ONLINE, '-inf', threshold);

      if (staleUserIds.length === 0) return [];

      const pipeline = redis.pipeline();
      for (const userId of staleUserIds) {
        pipeline.zrem(KEYS.ONLINE, userId);
        pipeline.del(KEYS.SESSION(userId));
        pipeline.set(KEYS.LAST_SEEN(userId), new Date().toISOString(), 'EX', LAST_SEEN_TTL);
      }
      await pipeline.exec();

      console.log(`🧹 Cleaned ${staleUserIds.length} stale presence entries`);
      return staleUserIds;
    } catch {
      return [];
    }
  }

  /**
   * Get online count (for admin/stats)
   * @returns {number}
   */
  async getOnlineCount() {
    try {
      return await redis.zcard(KEYS.ONLINE);
    } catch {
      return 0;
    }
  }
}

module.exports = new PresenceService();
module.exports.HEARTBEAT_INTERVAL = HEARTBEAT_INTERVAL;
module.exports.KEYS = KEYS;
