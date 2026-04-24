const mongoose = require('mongoose');

// ─── Notification Model ───────────────────────────────────────────
// Persists platform notifications with support for batching,
// multiple actor tracking, and per-user read state.

const notificationSchema = new mongoose.Schema(
  {
    // Recipient (null for system-wide / admin notifications)
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      default: null,
    },

    // Event classification
    type: {
      type: String,
      enum: [
        'post_liked',
        'post_commented',
        'comment_liked',
        'post_reported',
        'post_hidden',
        'post_deleted',
        'user_banned',
        'user_unbanned',
        'role_changed',
        'new_message',
        'message_reaction',
        'moderation_flag',
        'system_announcement',
      ],
      required: true,
    },

    // The entity this notification is about
    targetType: {
      type: String,
      enum: ['post', 'comment', 'user', 'conversation', 'system'],
      default: 'system',
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    // Who triggered this notification (may be empty for system events)
    actors: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        username: String,
        avatar: String,
      },
    ],
    actorCount: {
      type: Number,
      default: 1, // For batched: "and 3 others"
    },

    // Human-readable preview (generated server-side)
    title: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      default: '',
    },

    // Read state
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },

    // Arbitrary metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// Primary query: user's unread notifications, newest first
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

// Auto-cleanup: delete notifications after 30 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('Notification', notificationSchema);
