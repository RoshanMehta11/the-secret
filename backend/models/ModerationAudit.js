const mongoose = require('mongoose');

// ─── Moderation Audit Model ──────────────────────────────────────
// Records every moderation decision with full pipeline results
// for transparency, accountability, and research purposes.

const moderationAuditSchema = new mongoose.Schema(
  {
    targetType: {
      type: String,
      enum: ['post', 'comment'],
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    // Snapshot of content at time of moderation
    content: {
      type: String,
      required: true,
    },

    // Stage 1: Sync pre-filter results
    stage1Result: {
      passed: Boolean,
      triggers: [String], // Which blocklist words or patterns matched
      score: Number,
      latencyMs: Number,
    },

    // Stage 2: ML classification results
    stage2Result: {
      model: String, // 'openai-moderation', 'toxic-bert', 'heuristic-fallback'
      scores: mongoose.Schema.Types.Mixed,
      latencyMs: Number,
      error: String, // If model call failed
    },

    // Final decision
    decision: {
      type: String,
      enum: ['approved', 'flagged', 'rejected'],
      required: true,
    },
    actionTaken: {
      type: String,
      enum: ['none', 'hidden', 'deleted', 'user_warned', 'user_banned'],
      default: 'none',
    },

    // Human review (if escalated)
    humanReviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    humanDecision: {
      type: String,
      enum: ['approved', 'rejected', null],
      default: null,
    },
    humanReviewedAt: {
      type: Date,
      default: null,
    },
    humanNote: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

moderationAuditSchema.index({ targetType: 1, targetId: 1 });
moderationAuditSchema.index({ decision: 1, createdAt: -1 });

// Auto-cleanup: 30 days for approved, keep rejected indefinitely for research
moderationAuditSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 30 * 24 * 60 * 60,
    partialFilterExpression: { decision: 'approved' },
  }
);

module.exports = mongoose.model('ModerationAudit', moderationAuditSchema);
