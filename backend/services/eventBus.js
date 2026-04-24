const { EventEmitter } = require('events');

// ─── Event Bus ────────────────────────────────────────────────────
// Central in-process event bus for decoupled communication between
// controllers, services, and workers.
//
// Usage:
//   const eventBus = require('./services/eventBus');
//   eventBus.emit('post:liked', { postId, likerId, authorId });
//   eventBus.on('post:liked', (data) => handleLike(data));
//
// For cross-process events (horizontal scaling), Redis Pub/Sub is
// used via the Socket.IO Redis adapter. This EventEmitter handles
// in-process routing only.

class AppEventBus extends EventEmitter {
  constructor() {
    super();
    // Increase max listeners to avoid warnings with many consumers
    this.setMaxListeners(50);
  }

  /**
   * Emit an event with structured payload + timestamp
   * @param {string} event - Event name (e.g., 'post:liked')
   * @param {object} data - Event payload
   */
  emitEvent(event, data) {
    const payload = {
      ...data,
      _emittedAt: Date.now(),
      _event: event,
    };
    this.emit(event, payload);
  }

  /**
   * Register a listener with error handling
   * @param {string} event - Event name
   * @param {Function} handler - Async or sync handler
   */
  onEvent(event, handler) {
    this.on(event, async (data) => {
      try {
        await handler(data);
      } catch (err) {
        console.error(`❌ EventBus handler error [${event}]:`, err.message);
      }
    });
  }
}

// Singleton instance
const eventBus = new AppEventBus();

// ─── Event Catalog ────────────────────────────────────────────────
// Document all events for maintainability
//
// Post events:
//   'post:created'    → { postId, authorId, content, tags, isAnonymous }
//   'post:liked'      → { postId, likerId, authorId }
//   'post:unliked'    → { postId, unlikerId, authorId }
//   'post:commented'  → { postId, commentId, commenterId, authorId }
//   'post:reported'   → { postId, reporterId, reason }
//   'post:moderated'  → { postId, decision, scores }
//
// Chat events:
//   'message:sent'    → { messageId, conversationId, senderId, recipientId }
//
// User events:
//   'user:banned'     → { userId, reason, bannedBy }
//   'user:unbanned'   → { userId, unbannedBy }
//   'user:role_changed' → { userId, newRole, changedBy }
//
// Moderation events:
//   'moderation:complete'  → { targetId, targetType, decision, scores }
//   'moderation:escalated' → { targetId, targetType, reason }
//
// Analytics events:
//   'activity'        → { type, userId, ipHash?, targetId?, timestamp }

module.exports = eventBus;
