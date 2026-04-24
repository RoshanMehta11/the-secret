const { redis } = require('../config/redis');
const eventBus = require('./eventBus');

// ─── Moderation Service ───────────────────────────────────────────
// Two-stage content moderation pipeline:
//   Stage 1 (Sync, <5ms): Blocklist + pattern heuristics
//   Stage 2 (Async): ML classification (stubbed for external API integration)

// Default blocklist — stored in Redis for hot updates by admins
const DEFAULT_BLOCKLIST = [
  // Placeholder — admin can update via API
];

const KEYS = {
  BLOCKLIST: 'moderation:blocklist',
  USER_STRIKES: (userId) => `moderation:strikes:${userId}`,
};

class ModerationService {
  constructor() {
    this._initBlocklist();
  }

  async _initBlocklist() {
    try {
      const existing = await redis.scard(KEYS.BLOCKLIST);
      if (existing === 0 && DEFAULT_BLOCKLIST.length > 0) {
        await redis.sadd(KEYS.BLOCKLIST, ...DEFAULT_BLOCKLIST);
      }
    } catch (err) {
      // Redis may not be available on startup — log and continue
      console.warn('⚠️ ModerationService: Redis not available for blocklist init');
    }
  }

  // ─── Stage 1: Synchronous Pre-Filter ─────────────────────────

  /**
   * Run synchronous pre-filter checks on content.
   * Returns { passed, triggers[], score }
   * @param {string} content - Raw text content
   * @returns {object} result
   */
  async preFilter(content) {
    const startTime = Date.now();
    const triggers = [];
    let score = 0;

    if (!content || typeof content !== 'string') {
      return { passed: true, triggers: [], score: 0, latencyMs: 0 };
    }

    const normalized = content.toLowerCase().trim();

    // 1. Blocklist check
    try {
      const blocklist = await redis.smembers(KEYS.BLOCKLIST);
      for (const word of blocklist) {
        if (normalized.includes(word.toLowerCase())) {
          triggers.push(`blocklist:${word}`);
          score += 0.8;
        }
      }
    } catch {
      // If Redis is down, skip blocklist check
    }

    // 2. Pattern checks
    // >80% caps in content longer than 10 chars
    if (content.length > 10) {
      const uppercaseRatio = (content.match(/[A-Z]/g) || []).length / content.length;
      if (uppercaseRatio > 0.8) {
        triggers.push('pattern:excessive_caps');
        score += 0.3;
      }
    }

    // Repeated characters (>4 same char in a row): "aaaaaaa"
    if (/(.)\1{4,}/g.test(content)) {
      triggers.push('pattern:repeated_chars');
      score += 0.2;
    }

    // URL spam: more than 3 URLs in a single post
    const urlCount = (content.match(/https?:\/\/\S+/gi) || []).length;
    if (urlCount > 3) {
      triggers.push('pattern:url_spam');
      score += 0.5;
    }

    // Very short meaningless content
    if (normalized.length < 3 && !/^(hi|ok|no|ya|ye)$/i.test(normalized)) {
      triggers.push('pattern:too_short');
      score += 0.1;
    }

    const passed = score < 0.7; // Threshold for sync rejection
    const latencyMs = Date.now() - startTime;

    return { passed, triggers, score: Math.min(score, 1), latencyMs };
  }

  // ─── Stage 2: Async ML Classification (Stub) ─────────────────

  /**
   * Classify content using ML models.
   * Currently returns mock scores — replace with real API calls.
   *
   * In production, integrate:
   *   - OpenAI Moderation API (primary)
   *   - TensorFlow.js toxicity model (fallback)
   *
   * @param {string} content
   * @returns {object} { scores, model, latencyMs }
   */
  async classifyContent(content) {
    const startTime = Date.now();

    try {
      // ── Option 1: OpenAI Moderation API ──
      // Uncomment when OPENAI_API_KEY is configured:
      //
      // const response = await fetch('https://api.openai.com/v1/moderations', {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({ input: content }),
      // });
      // const data = await response.json();
      // const categories = data.results[0].category_scores;
      // return {
      //   scores: {
      //     toxicity: Math.max(categories.hate, categories.harassment, categories['hate/threatening']),
      //     spam: 0, // OpenAI doesn't detect spam
      //     threat: categories['violence'],
      //     identity_attack: categories.hate,
      //     sexually_explicit: categories.sexual,
      //   },
      //   model: 'openai-moderation',
      //   latencyMs: Date.now() - startTime,
      // };

      // ── Fallback: Heuristic-based scoring ──
      // Simple keyword-based scoring as placeholder
      const scores = {
        toxicity: this._heuristicToxicity(content),
        spam: this._heuristicSpam(content),
        threat: 0.0,
        identity_attack: 0.0,
        sexually_explicit: 0.0,
      };

      return {
        scores,
        model: 'heuristic-fallback',
        latencyMs: Date.now() - startTime,
        error: null,
      };
    } catch (err) {
      return {
        scores: null,
        model: 'none',
        latencyMs: Date.now() - startTime,
        error: err.message,
      };
    }
  }

  _heuristicToxicity(content) {
    // Basic heuristic — returns 0.0-1.0
    const lower = content.toLowerCase();
    let score = 0;
    const indicators = ['hate', 'kill', 'die', 'stupid', 'idiot', 'loser'];
    for (const word of indicators) {
      if (lower.includes(word)) score += 0.15;
    }
    return Math.min(score, 1.0);
  }

  _heuristicSpam(content) {
    let score = 0;
    // Multiple URLs
    const urls = (content.match(/https?:\/\/\S+/gi) || []).length;
    if (urls > 1) score += 0.3;
    if (urls > 3) score += 0.4;
    // Repeated text patterns
    if (/(.{10,})\1{2,}/.test(content)) score += 0.5;
    return Math.min(score, 1.0);
  }

  // ─── Decision Engine ─────────────────────────────────────────

  /**
   * Make moderation decision based on scores
   * @param {object} scores - { toxicity, spam, threat, ... }
   * @returns {object} { decision, actionTaken }
   */
  makeDecision(scores) {
    if (!scores) return { decision: 'approved', actionTaken: 'none' };

    const maxToxic = Math.max(scores.toxicity || 0, scores.threat || 0, scores.identity_attack || 0);

    if (maxToxic > 0.8 || scores.spam > 0.8) {
      return { decision: 'rejected', actionTaken: 'hidden' };
    }

    if (maxToxic > 0.5 || scores.spam > 0.5) {
      return { decision: 'flagged', actionTaken: 'none' };
    }

    return { decision: 'approved', actionTaken: 'none' };
  }

  // ─── User Strike Tracking ────────────────────────────────────

  /**
   * Record a moderation strike for a user
   * Auto-ban after 3 strikes within 1 hour
   */
  async recordStrike(userId) {
    if (!userId) return { strikes: 0, autoBanned: false };

    const key = KEYS.USER_STRIKES(userId);
    const strikes = await redis.incr(key);
    if (strikes === 1) {
      await redis.expire(key, 3600); // 1 hour window
    }

    const autoBanned = strikes >= 3;
    return { strikes, autoBanned };
  }

  // ─── Blocklist Management ────────────────────────────────────

  async getBlocklist() {
    return await redis.smembers(KEYS.BLOCKLIST);
  }

  async addToBlocklist(words) {
    if (words.length > 0) {
      await redis.sadd(KEYS.BLOCKLIST, ...words);
    }
  }

  async removeFromBlocklist(words) {
    if (words.length > 0) {
      await redis.srem(KEYS.BLOCKLIST, ...words);
    }
  }

  // ─── Full Pipeline ───────────────────────────────────────────

  /**
   * Run full moderation pipeline on content
   * @param {string} content
   * @param {string} targetId - Post or comment ID
   * @param {string} targetType - 'post' or 'comment'
   * @param {string} authorId
   * @returns {object} { stage1, stage2, decision, actionTaken }
   */
  async moderate(content, targetId, targetType, authorId) {
    // Stage 1: Sync pre-filter
    const stage1 = await this.preFilter(content);

    if (!stage1.passed) {
      // Immediate rejection
      const { strikes, autoBanned } = await this.recordStrike(authorId);

      eventBus.emitEvent('moderation:complete', {
        targetId,
        targetType,
        decision: 'rejected',
        scores: { prefilter: stage1.score },
        autoBanned,
      });

      return {
        stage1,
        stage2: null,
        decision: 'rejected',
        actionTaken: 'hidden',
        autoBanned,
      };
    }

    // Stage 2: Async ML classification
    const stage2 = await this.classifyContent(content);
    const { decision, actionTaken } = this.makeDecision(stage2.scores);

    if (decision === 'rejected') {
      await this.recordStrike(authorId);
    }

    eventBus.emitEvent('moderation:complete', {
      targetId,
      targetType,
      decision,
      scores: stage2.scores,
      authorId,
    });

    return { stage1, stage2, decision, actionTaken };
  }
}

module.exports = new ModerationService();
