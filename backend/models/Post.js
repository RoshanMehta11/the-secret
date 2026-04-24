const mongoose = require('mongoose');

// ─── Enhanced Post Schema ─────────────────────────────────────────
// Adds moderation fields (Phase 5) and feed scoring (Phase 7).

const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // null = guest post
    },
    isAnonymous: {
      type: Boolean,
      default: true,
    },
    content: {
      type: String,
      required: [true, 'Post content is required'],
      maxlength: [2000, 'Post cannot exceed 2000 characters'],
      trim: true,
    },
    contentType: {
      type: String,
      enum: ['text', 'image', 'video', 'audio'],
      default: 'text',
    },
    mood: {
      type: String,
      enum: ['confession', 'rant', 'positive', 'random'],
      default: 'random',
    },
    mediaUrl: {
      type: String,
      default: '',
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    likesCount: {
      type: Number,
      default: 0,
    },
    commentsCount: {
      type: Number,
      default: 0,
    },
    isReported: {
      type: Boolean,
      default: false,
    },
    reportCount: {
      type: Number,
      default: 0,
    },
    isHidden: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    ipHash: {
      type: String,
      select: false, // Never expose IP
    },

    // ── Phase 5: Moderation metadata ──────────────────────────
    moderationStatus: {
      type: String,
      enum: ['pending', 'approved', 'flagged', 'rejected', 'appealed'],
      default: 'pending',
      index: true,
    },
    moderationScores: {
      toxicity: { type: Number, default: null },
      spam: { type: Number, default: null },
      threat: { type: Number, default: null },
      identity_attack: { type: Number, default: null },
      sexually_explicit: { type: Number, default: null },
    },
    moderatedAt: {
      type: Date,
      default: null,
    },
    moderatedBy: {
      type: String,
      enum: ['system_blocklist', 'ai_classifier', 'human_admin', null],
      default: null,
    },

    // ── Phase 7: Smart Feed fields ────────────────────────────
    feedScore: {
      type: Number,
      default: 0,
      index: true,
    },
    feedScoreUpdatedAt: {
      type: Date,
      default: Date.now,
    },
    // Engagement velocity: likes+comments rate in recent window
    engagementVelocity: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────
postSchema.index({ createdAt: -1 });
postSchema.index({ tags: 1 });
postSchema.index({ isHidden: 1, isDeleted: 1 });

// Smart Feed compound index for efficient ranked queries
postSchema.index({ feedScore: -1, _id: -1 });
postSchema.index({ feedScore: -1, isHidden: 1, isDeleted: 1 });

// Trending: engagement velocity
postSchema.index({ engagementVelocity: -1, createdAt: -1 });

module.exports = mongoose.model('Post', postSchema);
