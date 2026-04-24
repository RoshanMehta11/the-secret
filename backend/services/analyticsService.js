const eventBus = require('./eventBus');

// ─── Analytics Service ────────────────────────────────────────────
// Privacy-preserving behavioral analytics:
//   - Never stores raw user activity
//   - Aggregates into time buckets (hourly/daily)
//   - All analytics server-side only (no client fingerprinting)
//
// Collects events from EventBus, processes in batches, stores aggregated profiles.

// In-memory event buffer for batch processing
let eventBuffer = [];
const BATCH_SIZE = 100;
const FLUSH_INTERVAL = 30000; // 30 seconds

class AnalyticsService {
  constructor() {
    this._registerListeners();
    this._startFlushTimer();
  }

  _registerListeners() {
    eventBus.onEvent('activity', (data) => this._bufferEvent(data));

    // Also capture structured events
    eventBus.onEvent('post:created', (data) => {
      this._bufferEvent({ type: 'post_created', userId: data.authorId, timestamp: Date.now() });
    });
    eventBus.onEvent('post:liked', (data) => {
      this._bufferEvent({ type: 'post_liked', userId: data.likerId, targetId: data.postId, timestamp: Date.now() });
    });
    eventBus.onEvent('post:commented', (data) => {
      this._bufferEvent({ type: 'comment_created', userId: data.commenterId, targetId: data.postId, timestamp: Date.now() });
    });
  }

  _bufferEvent(event) {
    eventBuffer.push({
      ...event,
      _bufferedAt: Date.now(),
    });

    if (eventBuffer.length >= BATCH_SIZE) {
      this._flushBuffer();
    }
  }

  _startFlushTimer() {
    setInterval(() => {
      if (eventBuffer.length > 0) {
        this._flushBuffer();
      }
    }, FLUSH_INTERVAL);
  }

  async _flushBuffer() {
    const events = [...eventBuffer];
    eventBuffer = [];

    if (events.length === 0) return;

    try {
      await this._processEventBatch(events);
    } catch (err) {
      console.error('❌ Analytics flush error:', err.message);
    }
  }

  /**
   * Process a batch of events into aggregated storage
   */
  async _processEventBatch(events) {
    // Group events by userId and hourly period
    const aggregates = {};

    for (const event of events) {
      if (!event.userId) continue;

      const hourStart = new Date(event.timestamp || event._bufferedAt);
      hourStart.setMinutes(0, 0, 0);
      const key = `${event.userId}:${hourStart.toISOString()}`;

      if (!aggregates[key]) {
        aggregates[key] = {
          userId: event.userId,
          period: 'hourly',
          periodStart: hourStart,
          counts: {
            posts_created: 0,
            comments_created: 0,
            likes_given: 0,
            reports_filed: 0,
            logins: 0,
            messages_sent: 0,
          },
          uniquePostsInteracted: new Set(),
          uniqueUsersInteracted: new Set(),
        };
      }

      const agg = aggregates[key];

      // Increment appropriate counter
      switch (event.type) {
        case 'post_created':
          agg.counts.posts_created += 1;
          break;
        case 'comment_created':
          agg.counts.comments_created += 1;
          if (event.targetId) agg.uniquePostsInteracted.add(event.targetId);
          break;
        case 'post_liked':
          agg.counts.likes_given += 1;
          if (event.targetId) agg.uniquePostsInteracted.add(event.targetId);
          break;
        case 'post_reported':
          agg.counts.reports_filed += 1;
          break;
        case 'login':
          agg.counts.logins += 1;
          break;
        case 'message_sent':
          agg.counts.messages_sent += 1;
          break;
      }
    }

    // Persist aggregates to MongoDB (upsert pattern)
    const ActivityAggregate = require('../models/ActivityAggregate');

    const bulkOps = Object.values(aggregates).map((agg) => ({
      updateOne: {
        filter: {
          userId: agg.userId,
          period: agg.period,
          periodStart: agg.periodStart,
        },
        update: {
          $inc: {
            'counts.posts_created': agg.counts.posts_created,
            'counts.comments_created': agg.counts.comments_created,
            'counts.likes_given': agg.counts.likes_given,
            'counts.reports_filed': agg.counts.reports_filed,
            'counts.logins': agg.counts.logins,
            'counts.messages_sent': agg.counts.messages_sent,
          },
          $max: {
            uniquePostsInteracted: agg.uniquePostsInteracted.size,
            uniqueUsersInteracted: agg.uniqueUsersInteracted.size,
          },
        },
        upsert: true,
      },
    }));

    if (bulkOps.length > 0) {
      await ActivityAggregate.bulkWrite(bulkOps);
    }
  }

  /**
   * Get activity overview for admin dashboard
   */
  async getOverview() {
    const ActivityAggregate = require('../models/ActivityAggregate');

    const now = new Date();
    const today = new Date(now.setHours(0, 0, 0, 0));
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [todayAgg, weekAgg] = await Promise.all([
      ActivityAggregate.aggregate([
        { $match: { periodStart: { $gte: today } } },
        {
          $group: {
            _id: null,
            posts: { $sum: '$counts.posts_created' },
            comments: { $sum: '$counts.comments_created' },
            likes: { $sum: '$counts.likes_given' },
            logins: { $sum: '$counts.logins' },
            messages: { $sum: '$counts.messages_sent' },
          },
        },
      ]),
      ActivityAggregate.aggregate([
        { $match: { periodStart: { $gte: weekAgo } } },
        {
          $group: {
            _id: null,
            posts: { $sum: '$counts.posts_created' },
            comments: { $sum: '$counts.comments_created' },
            likes: { $sum: '$counts.likes_given' },
            logins: { $sum: '$counts.logins' },
            activeUsers: { $addToSet: '$userId' },
          },
        },
      ]),
    ]);

    return {
      today: todayAgg[0] || { posts: 0, comments: 0, likes: 0, logins: 0, messages: 0 },
      week: {
        ...(weekAgg[0] || { posts: 0, comments: 0, likes: 0, logins: 0 }),
        activeUsers: weekAgg[0]?.activeUsers?.length || 0,
      },
    };
  }
}

module.exports = new AnalyticsService();
