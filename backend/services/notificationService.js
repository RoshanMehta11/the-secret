const Notification = require('../models/Notification');
const { redis } = require('../config/redis');
const eventBus = require('./eventBus');

// ─── Notification Service ─────────────────────────────────────────
// Handles notification creation, batching, rate control, and delivery.
// Consumes events from the EventBus and produces socket + persisted notifications.
//
// GRACEFUL DEGRADATION: When Redis is unavailable, skips batching/rate-limiting
// and delivers notifications directly.

const KEYS = {
  UNREAD_COUNT: (userId) => `notif:unread:${userId}`,
  DEDUP: (type, targetId, actorId) => `notif:dedup:${type}:${targetId}:${actorId}`,
  BATCH: (userId, type, targetId) => `notif:batch:${userId}:${type}:${targetId}`,
  RATE: (userId) => `notif:rate:${userId}`,
};

const BATCH_WINDOW_MS = 5000;   // 5-second batch window
const MAX_PER_MINUTE = 10;      // Rate limit: max 10 notifications per minute per user
const MAX_ACTORS_STORED = 5;    // Store up to 5 actor details in batched notifications

class NotificationService {
  constructor() {
    this.io = null; // Set by server.js after Socket.IO init
    this.batchTimers = new Map();
    this._registerListeners();
  }

  /**
   * Inject Socket.IO instance for real-time delivery
   */
  setIO(io) {
    this.io = io;
  }

  // ─── Event Listeners ─────────────────────────────────────────

  _registerListeners() {
    eventBus.onEvent('post:liked', (data) => this._handlePostLiked(data));
    eventBus.onEvent('post:commented', (data) => this._handlePostCommented(data));
    eventBus.onEvent('post:reported', (data) => this._handlePostReported(data));
    eventBus.onEvent('post:moderated', (data) => this._handlePostModerated(data));
    eventBus.onEvent('user:banned', (data) => this._handleUserBanned(data));
    eventBus.onEvent('user:unbanned', (data) => this._handleUserUnbanned(data));
    eventBus.onEvent('user:role_changed', (data) => this._handleRoleChanged(data));
  }

  // ─── Event Handlers ──────────────────────────────────────────

  async _handlePostLiked({ postId, likerId, authorId, likerUsername, likerAvatar }) {
    // Don't notify self-likes
    if (likerId === authorId || !authorId) return;

    await this._createBatchedNotification({
      recipient: authorId,
      type: 'post_liked',
      targetType: 'post',
      targetId: postId,
      actor: { userId: likerId, username: likerUsername, avatar: likerAvatar },
    });
  }

  async _handlePostCommented({ postId, commentId, commenterId, authorId, commenterUsername, commenterAvatar }) {
    if (commenterId === authorId || !authorId) return;

    await this._createBatchedNotification({
      recipient: authorId,
      type: 'post_commented',
      targetType: 'post',
      targetId: postId,
      actor: { userId: commenterId, username: commenterUsername, avatar: commenterAvatar },
    });
  }

  async _handlePostReported({ postId, reporterId }) {
    // Notify admins — this skips batching
    await this._createNotification({
      recipient: null, // Will be sent to admin channel
      type: 'post_reported',
      targetType: 'post',
      targetId: postId,
      title: 'Post reported',
      body: 'A post has been reported and needs review.',
      actors: [],
      actorCount: 0,
    });
  }

  async _handlePostModerated({ postId, decision, authorId }) {
    if (!authorId) return;

    const titles = {
      approved: 'Post approved',
      flagged: 'Post under review',
      rejected: 'Post removed',
    };

    const bodies = {
      approved: 'Your post has been reviewed and approved.',
      flagged: 'Your post is being reviewed by moderators.',
      rejected: 'Your post was removed for violating guidelines. You can appeal this decision.',
    };

    await this._createNotification({
      recipient: authorId,
      type: 'moderation_flag',
      targetType: 'post',
      targetId: postId,
      title: titles[decision] || 'Moderation update',
      body: bodies[decision] || 'Your post moderation status has changed.',
      actors: [],
      actorCount: 0,
    });
  }

  async _handleUserBanned({ userId, reason }) {
    await this._createNotification({
      recipient: userId,
      type: 'user_banned',
      targetType: 'user',
      targetId: userId,
      title: 'Account suspended',
      body: `Your account has been suspended. Reason: ${reason || 'Violation of terms'}`,
      actors: [],
      actorCount: 0,
    });
  }

  async _handleUserUnbanned({ userId }) {
    await this._createNotification({
      recipient: userId,
      type: 'user_unbanned',
      targetType: 'user',
      targetId: userId,
      title: 'Account restored',
      body: 'Your account has been restored. Welcome back!',
      actors: [],
      actorCount: 0,
    });
  }

  async _handleRoleChanged({ userId, newRole }) {
    await this._createNotification({
      recipient: userId,
      type: 'role_changed',
      targetType: 'user',
      targetId: userId,
      title: 'Role updated',
      body: `Your role has been changed to ${newRole}.`,
      actors: [],
      actorCount: 0,
    });
  }

  // ─── Batching Logic ──────────────────────────────────────────

  async _createBatchedNotification({ recipient, type, targetType, targetId, actor }) {
    const batchKey = KEYS.BATCH(recipient, type, targetId);
    const dedupKey = KEYS.DEDUP(type, targetId, actor.userId);

    // Deduplication: has this actor already triggered this notification?
    try {
      const alreadyNotified = await redis.get(dedupKey);
      if (alreadyNotified) return;

      // Mark as notified (1h TTL)
      await redis.set(dedupKey, '1', 'EX', 3600);

      // Get existing batch
      const existingBatch = await redis.get(batchKey);
      let batch;

      if (existingBatch) {
        batch = JSON.parse(existingBatch);
        batch.actorCount += 1;
        if (batch.actors.length < MAX_ACTORS_STORED) {
          batch.actors.push(actor);
        }
      } else {
        batch = {
          recipient,
          type,
          targetType,
          targetId,
          actors: [actor],
          actorCount: 1,
        };
      }

      // Store batch with 5s TTL
      await redis.set(batchKey, JSON.stringify(batch), 'PX', BATCH_WINDOW_MS);

      // Set flush timer (only if new batch)
      const timerKey = `${recipient}:${type}:${targetId}`;
      if (!this.batchTimers.has(timerKey)) {
        const timer = setTimeout(async () => {
          this.batchTimers.delete(timerKey);
          await this._flushBatch(batchKey, recipient, type, targetId);
        }, BATCH_WINDOW_MS);
        this.batchTimers.set(timerKey, timer);
      }
    } catch {
      // Redis unavailable — skip batching, create notification directly
      const { title, body } = this._generateText({
        type,
        actors: [actor],
        actorCount: 1,
      });
      await this._createNotification({
        recipient, type, targetType, targetId,
        title, body, actors: [actor], actorCount: 1,
      });
    }
  }

  async _flushBatch(batchKey, recipient, type, targetId) {
    try {
      const batchData = await redis.get(batchKey);
      if (!batchData) return;

      const batch = JSON.parse(batchData);
      await redis.del(batchKey);

      // Generate human-readable text
      const { title, body } = this._generateText(batch);

      await this._createNotification({
        recipient: batch.recipient,
        type: batch.type,
        targetType: batch.targetType,
        targetId: batch.targetId,
        title,
        body,
        actors: batch.actors,
        actorCount: batch.actorCount,
      });
    } catch (err) {
      console.warn('_flushBatch error:', err.message);
    }
  }

  _generateText(batch) {
    const firstActor = batch.actors[0]?.username || 'Someone';
    const othersCount = batch.actorCount - 1;

    const templates = {
      post_liked: {
        title: 'New like on your post',
        body: othersCount > 0
          ? `${firstActor} and ${othersCount} other${othersCount > 1 ? 's' : ''} liked your post`
          : `${firstActor} liked your post`,
      },
      post_commented: {
        title: 'New comment on your post',
        body: othersCount > 0
          ? `${firstActor} and ${othersCount} other${othersCount > 1 ? 's' : ''} commented on your post`
          : `${firstActor} commented on your post`,
      },
      comment_liked: {
        title: 'Your comment was liked',
        body: othersCount > 0
          ? `${firstActor} and ${othersCount} other${othersCount > 1 ? 's' : ''} liked your comment`
          : `${firstActor} liked your comment`,
      },
    };

    return templates[batch.type] || { title: 'New notification', body: 'You have a new notification' };
  }

  // ─── Core Create + Deliver ───────────────────────────────────

  /**
   * Rate check → persist → deliver
   */
  async _createNotification({ recipient, type, targetType, targetId, title, body, actors, actorCount }) {
    // Skip rate check for system notifications
    if (recipient) {
      try {
        const rateLimited = await this._checkRate(recipient);
        if (rateLimited) {
          console.log(`⏳ Notification rate-limited for user ${recipient}`);
          return null;
        }
      } catch {
        // Redis unavailable — skip rate check
      }
    }

    // Persist to MongoDB
    const notification = await Notification.create({
      recipient,
      type,
      targetType,
      targetId,
      title,
      body,
      actors: actors || [],
      actorCount: actorCount || 0,
    });

    // Update unread counter in Redis
    if (recipient) {
      try {
        await redis.incr(KEYS.UNREAD_COUNT(recipient));
      } catch {
        // Redis unavailable — counter will be recalculated on next read
      }
    }

    // Real-time delivery via Socket.IO
    this._deliver(notification);

    return notification;
  }

  async _checkRate(userId) {
    const key = KEYS.RATE(userId);
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 60); // 1-minute window
    }
    return count > MAX_PER_MINUTE;
  }

  _deliver(notification) {
    if (!this.io) return;

    if (notification.recipient) {
      // Deliver to specific user
      this.io.to(notification.recipient.toString()).emit('notification', {
        id: notification._id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        actors: notification.actors,
        targetType: notification.targetType,
        targetId: notification.targetId,
        createdAt: notification.createdAt,
      });
    } else {
      // Broadcast to admin room for system notifications
      this.io.to('admin').emit('notification', {
        id: notification._id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        createdAt: notification.createdAt,
      });
    }
  }

  // ─── Public API Methods ──────────────────────────────────────

  /**
   * Get unread count from Redis (O(1)), fallback to MongoDB
   */
  async getUnreadCount(userId) {
    try {
      const count = await redis.get(KEYS.UNREAD_COUNT(userId));
      if (count !== null) return parseInt(count) || 0;
    } catch {}
    // Fallback: count from MongoDB
    try {
      return await Notification.countDocuments({ recipient: userId, isRead: false });
    } catch {
      return 0;
    }
  }

  /**
   * Mark notifications as read and update counter
   */
  async markAsRead(userId, notificationIds) {
    const result = await Notification.updateMany(
      { _id: { $in: notificationIds }, recipient: userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    // Decrement unread counter
    if (result.modifiedCount > 0) {
      try {
        await redis.decrby(KEYS.UNREAD_COUNT(userId), result.modifiedCount);
        // Ensure counter doesn't go negative
        const current = await redis.get(KEYS.UNREAD_COUNT(userId));
        if (parseInt(current) < 0) {
          await redis.set(KEYS.UNREAD_COUNT(userId), '0');
        }
      } catch {
        // Redis unavailable — counter will self-correct
      }
    }

    return result.modifiedCount;
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId) {
    await Notification.updateMany(
      { recipient: userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    try {
      await redis.set(KEYS.UNREAD_COUNT(userId), '0');
    } catch {}
  }
}

module.exports = new NotificationService();
