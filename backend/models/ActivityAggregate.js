const mongoose = require('mongoose');

// ─── Activity Aggregate Model ─────────────────────────────────────
// Stores aggregated (never raw) user activity in time buckets.
// Privacy-preserving: no individual actions are recoverable.

const activityAggregateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    period: {
      type: String,
      enum: ['hourly', 'daily'],
      required: true,
    },
    periodStart: {
      type: Date,
      required: true,
    },

    // Activity counts per type
    counts: {
      posts_created: { type: Number, default: 0 },
      comments_created: { type: Number, default: 0 },
      likes_given: { type: Number, default: 0 },
      reports_filed: { type: Number, default: 0 },
      logins: { type: Number, default: 0 },
      messages_sent: { type: Number, default: 0 },
    },

    // Timing features
    avgInterEventMs: { type: Number, default: null },
    sessionDurationMs: { type: Number, default: null },

    // Interaction breadth (aggregated, not individual targets)
    uniquePostsInteracted: { type: Number, default: 0 },
    uniqueUsersInteracted: { type: Number, default: 0 },
  },
  { timestamps: true }
);

activityAggregateSchema.index({ userId: 1, period: 1, periodStart: -1 });

// Auto-cleanup: keep 90 days of hourly, indefinite daily
activityAggregateSchema.index(
  { periodStart: 1 },
  {
    expireAfterSeconds: 90 * 24 * 60 * 60,
    partialFilterExpression: { period: 'hourly' },
  }
);

module.exports = mongoose.model('ActivityAggregate', activityAggregateSchema);
