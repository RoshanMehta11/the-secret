const mongoose = require('mongoose');

// ─── User Feed State Model ───────────────────────────────────────
// Tracks implicit user preferences for personalized feed ranking.
// Built from engagement patterns, not explicit user input.

const userFeedStateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },

    // Implicit preference signals (learned from likes/comments/dwell time)
    tagAffinities: {
      type: Map,
      of: Number, // tag → affinity score (0-1)
      default: {},
    },

    // Content length preference (learned from engagement patterns)
    preferredContentLength: {
      type: String,
      enum: ['short', 'medium', 'long', 'any'],
      default: 'any',
    },

    // Recently seen posts (for diversity injection)
    // Capped at last 200 to prevent unbounded growth
    seenPosts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post',
      },
    ],

    // Engagement signals for preference learning
    totalLikes: { type: Number, default: 0 },
    totalComments: { type: Number, default: 0 },

    lastFeedRefresh: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Cap seenPosts array to 200 entries on every save
userFeedStateSchema.pre('save', function (next) {
  if (this.seenPosts && this.seenPosts.length > 200) {
    this.seenPosts = this.seenPosts.slice(-200);
  }
  next();
});

module.exports = mongoose.model('UserFeedState', userFeedStateSchema);
