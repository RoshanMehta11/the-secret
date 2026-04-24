const mongoose = require('mongoose');

// ─── Behavior Profile Model ──────────────────────────────────────
// Aggregated behavioral fingerprint per user, updated daily.
// Used for abuse detection and feed trust scoring.

const behaviorProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },

    // Activity level classification
    activityLevel: {
      type: String,
      enum: ['dormant', 'low', 'moderate', 'high', 'hyperactive'],
      default: 'low',
    },

    // Behavioral features (updated daily by analytics worker)
    features: {
      avgPostsPerDay: { type: Number, default: 0 },
      avgCommentsPerDay: { type: Number, default: 0 },
      avgLikesPerDay: { type: Number, default: 0 },
      peakActivityHourUTC: { type: Number, default: null, min: 0, max: 23 },
      avgSessionDurationMin: { type: Number, default: 0 },
      contentLengthAvg: { type: Number, default: 0 },
      anonymousPostRatio: { type: Number, default: 0, min: 0, max: 1 },
      reportFiledRate: { type: Number, default: 0 },     // reports filed / total interactions
      reportReceivedRate: { type: Number, default: 0 },   // reports received / total posts
    },

    // Risk assessment (0-100)
    riskScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    riskFactors: [String],

    // Coordinated abuse detection
    suspectedAliases: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    aliasConfidence: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
    },

    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

behaviorProfileSchema.index({ riskScore: -1 });
behaviorProfileSchema.index({ activityLevel: 1 });

module.exports = mongoose.model('BehaviorProfile', behaviorProfileSchema);
