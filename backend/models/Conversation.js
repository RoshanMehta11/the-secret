const mongoose = require('mongoose');

// ─── Enhanced Conversation Schema ─────────────────────────────────
// Adds monotonic counter for message ordering and per-participant
// read cursors for efficient unread tracking.

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    lastMessage: {
      type: String,
      default: '',
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    // ── Post context: when conversation started from a post ──
    postContext: {
      postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null },
      contentPreview: { type: String, default: '' },
      mood: { type: String, default: 'random' },
    },

    // ── Phase 2: Message ordering ─────────────────────────────
    // Monotonic counter incremented atomically for each new message.
    // Each message gets a unique, ordered seqNum within this conversation.
    seqCounter: {
      type: Number,
      default: 0,
    },

    // ── Phase 2: Per-participant read cursor ──────────────────
    // Maps userId → last seqNum they've seen.
    // More efficient than querying unread counts per message.
    readCursors: {
      type: Map,
      of: Number, // userId → last seqNum they've seen
      default: {},
    },
  },
  { timestamps: true }
);

// Ensure exactly 2 participants
conversationSchema.pre('save', function (next) {
  if (this.participants.length !== 2) {
    return next(new Error('Conversation must have exactly 2 participants'));
  }
  next();
});

// Index for quick lookup of a user's conversations
conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastMessageAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
