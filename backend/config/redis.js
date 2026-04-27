const Redis = require('ioredis');

// ─── Redis Client Configuration ──────────────────────────────────
// Used for: caching, rate limiting, presence, job queues, pub/sub
//
// RENDER DEPLOYMENT: Redis is OPTIONAL.
// If REDIS_URL is not set, a no-op stub is used so the app
// runs without Redis (features like presence, caching, batching
// degrade gracefully instead of crashing).

// ── No-Op Redis Stub ─────────────────────────────────────────────
// Returns safe defaults for all Redis commands when Redis is unavailable.
class RedisStub {
  constructor() {
    this._connected = false;
  }

  // All read commands return null/empty
  async get() { return null; }
  async set() { return 'OK'; }
  async del() { return 0; }
  async incr() { return 1; }
  async decr() { return 0; }
  async decrby() { return 0; }
  async expire() { return 1; }
  async keys() { return []; }
  async ping() { throw new Error('Redis not configured'); }

  // Set operations
  async sadd() { return 0; }
  async srem() { return 0; }
  async scard() { return 0; }
  async smembers() { return []; }
  async sismember() { return 0; }

  // Hash operations
  async hset() { return 0; }
  async hget() { return null; }
  async hdel() { return 0; }
  async hlen() { return 0; }

  // Sorted set operations
  async zadd() { return 0; }
  async zrem() { return 0; }
  async zscore() { return null; }
  async zrange() { return []; }
  async zrangebyscore() { return []; }
  async zcard() { return 0; }

  // List operations
  async lrange() { return []; }
  async lpush() { return 0; }
  async rpush() { return 0; }
  async ltrim() { return 'OK'; }

  // Pipeline stub — returns a pipeline-like object
  pipeline() {
    const ops = [];
    const self = this;
    const pipelineProxy = new Proxy({}, {
      get(target, prop) {
        if (prop === 'exec') {
          return async () => ops.map(() => [null, null]);
        }
        // Any Redis command on the pipeline just records a no-op
        return (...args) => {
          ops.push([prop, args]);
          return pipelineProxy;
        };
      },
    });
    return pipelineProxy;
  }

  // Event emitter stubs
  on() { return this; }
  once() { return this; }
  emit() { return this; }
  removeListener() { return this; }

  // Connection stubs
  async quit() {}
  disconnect() {}
  async connect() {}

  get status() { return 'end'; }
}

// ── Build the real or stub client ────────────────────────────────

let redis;
let redisAvailable = false;

if (process.env.REDIS_URL) {
  try {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 10) {
          console.error('🔴 Redis: max retries exceeded, giving up');
          return null; // stop retrying
        }
        const delay = Math.min(times * 200, 5000);
        console.log(`⏳ Redis retry attempt ${times}, next in ${delay}ms`);
        return delay;
      },
      lazyConnect: false,
    });

    redis.on('connect', () => {
      redisAvailable = true;
      console.log('🔴 Redis connected');
    });
    redis.on('ready', () => {
      redisAvailable = true;
    });
    redis.on('error', (err) => {
      console.error('🔴 Redis error:', err.message);
    });
    redis.on('close', () => {
      redisAvailable = false;
      console.warn('🔴 Redis connection closed');
    });
    redis.on('end', () => {
      redisAvailable = false;
    });

    console.log('✅ Redis client created (connecting to REDIS_URL)');
  } catch (err) {
    console.warn('⚠️ Redis client creation failed:', err.message);
    redis = new RedisStub();
  }
} else {
  console.log('⚠️ Redis disabled (no REDIS_URL set) — using in-memory stub');
  redis = new RedisStub();
}

// Separate clients for pub/sub (required by Socket.IO Redis adapter)
const createPubClient = () => {
  if (!process.env.REDIS_URL) return null;
  try {
    return new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        return times > 5 ? null : Math.min(times * 200, 3000);
      },
    });
  } catch (err) {
    console.warn('⚠️ Redis pub client creation failed:', err.message);
    return null;
  }
};

const createSubClient = () => {
  if (!process.env.REDIS_URL) return null;
  try {
    return new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        return times > 5 ? null : Math.min(times * 200, 3000);
      },
    });
  } catch (err) {
    console.warn('⚠️ Redis sub client creation failed:', err.message);
    return null;
  }
};

// Graceful shutdown helper
const disconnectRedis = async () => {
  if (redis instanceof RedisStub) return;
  try {
    await redis.quit();
    console.log('🔴 Redis disconnected gracefully');
  } catch (err) {
    console.error('🔴 Redis disconnect error:', err.message);
    try { redis.disconnect(); } catch {}
  }
};

// Helper to check if Redis is actually available
const isRedisAvailable = () => redisAvailable && !(redis instanceof RedisStub);

module.exports = {
  redis,
  RedisStub,
  createPubClient,
  createSubClient,
  disconnectRedis,
  isRedisAvailable,
};
