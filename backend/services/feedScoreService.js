const Post = require('../models/Post');
const { redis } = require('../config/redis');

// ─── Feed Score Calculator ────────────────────────────────────────
// Computes the multi-signal feed ranking score for posts.
//
// FeedScore = (w₁ × Recency) + (w₂ × Engagement) + (w₃ × Quality) + (w₄ × Trust) + Boost - Penalty
//
// Designed for anonymous platforms: no author-based personalization,
// purely content-signal driven ranking.

const WEIGHTS = {
  recency: 0.4,
  engagement: 0.3,
  quality: 0.2,
  trust: 0.1,
};

const DECAY_LAMBDA = 0.05; // Exponential decay factor
const NEW_POST_BOOST_DURATION = 30 * 60 * 1000; // 30 minutes
const NEW_POST_BOOST_VALUE = 0.5;

const KEYS = {
  FEED_CACHE: (cursor) => `feed:global:cursor:${cursor}`,
  POST_CACHE: (postId) => `post:${postId}`,
};

class FeedScoreService {
  /**
   * Calculate feed score for a single post
   * @param {object} post - Post document (lean or full)
   * @param {object} options - { authorRiskScore }
   * @returns {number} feedScore
   */
  calculateScore(post, options = {}) {
    const ageInHours = (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60);
    const authorRiskScore = options.authorRiskScore || 0;

    // 1. Recency Score: exponential decay
    const recencyScore = Math.exp(-DECAY_LAMBDA * ageInHours);

    // 2. Engagement Score: log dampening
    const engagementScore = Math.log(1 + (post.likesCount || 0) + 2 * (post.commentsCount || 0));

    // 3. Quality Score: content length × (1 - toxicity)
    const contentLength = (post.content || '').length;
    const toxicity = post.moderationScores?.toxicity || 0;
    const qualityScore = (contentLength / 2000) * (1 - toxicity);

    // 4. Trust Score: inverse of author risk
    const trustScore = 1 - (authorRiskScore / 100);

    // Weighted sum
    let score =
      WEIGHTS.recency * recencyScore +
      WEIGHTS.engagement * engagementScore +
      WEIGHTS.quality * qualityScore +
      WEIGHTS.trust * trustScore;

    // New post boost (first 30 minutes)
    const ageMs = Date.now() - new Date(post.createdAt).getTime();
    if (ageMs < NEW_POST_BOOST_DURATION) {
      score += NEW_POST_BOOST_VALUE * (1 - ageMs / NEW_POST_BOOST_DURATION);
    }

    // Penalty for reported content
    if (post.isReported) {
      score -= 0.1 * Math.min(post.reportCount || 0, 5);
    }

    return Math.max(0, parseFloat(score.toFixed(6)));
  }

  /**
   * Recalculate feed scores for recent posts (batch job)
   * Should run every 5 minutes via setInterval or CRON
   * @param {number} hoursBack - Only recalculate posts from last N hours
   */
  async recalculateBatch(hoursBack = 48) {
    const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    const posts = await Post.find({
      createdAt: { $gte: cutoff },
      isDeleted: false,
    }).lean();

    const bulkOps = posts.map((post) => ({
      updateOne: {
        filter: { _id: post._id },
        update: {
          $set: {
            feedScore: this.calculateScore(post),
            feedScoreUpdatedAt: new Date(),
          },
        },
      },
    }));

    if (bulkOps.length > 0) {
      const result = await Post.bulkWrite(bulkOps);
      console.log(`📊 Feed scores recalculated: ${result.modifiedCount}/${posts.length} posts updated`);
    }

    // Invalidate feed cache
    await this.invalidateFeedCache();

    return bulkOps.length;
  }

  /**
   * Recalculate score for a single post (on engagement event)
   */
  async recalculateSingle(postId) {
    const post = await Post.findById(postId).lean();
    if (!post) return;

    const score = this.calculateScore(post);
    await Post.findByIdAndUpdate(postId, {
      feedScore: score,
      feedScoreUpdatedAt: new Date(),
    });

    return score;
  }

  /**
   * Invalidate feed cache (call on score updates)
   */
  async invalidateFeedCache() {
    try {
      const keys = await redis.keys('feed:global:cursor:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch {
      // Redis may not be available
    }
  }

  /**
   * Calculate engagement velocity (likes + comments in last hour)
   */
  async calculateVelocity(postId) {
    // This would ideally use a time-series data structure
    // For now, approximate using current engagement counts
    const post = await Post.findById(postId).lean();
    if (!post) return 0;

    const ageHours = (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60);
    if (ageHours === 0) return 0;

    const totalEngagement = (post.likesCount || 0) + (post.commentsCount || 0);
    return totalEngagement / Math.max(ageHours, 1);
  }

  /**
   * Build cursor string for pagination
   */
  buildCursor(feedScore, postId) {
    return `${feedScore}_${postId}`;
  }

  /**
   * Parse cursor string
   */
  parseCursor(cursor) {
    if (!cursor) return null;
    const [score, id] = cursor.split('_');
    return { score: parseFloat(score), id };
  }
}

module.exports = new FeedScoreService();
