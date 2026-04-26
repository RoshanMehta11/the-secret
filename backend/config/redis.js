const Redis = require('ioredis');

// ─── Redis Client Configuration ──────────────────────────────────
// Used for: caching, rate limiting, presence, job queues, pub/sub

const redisConfig = process.env.REDIS_URL
  ? {
    // ✅ Production (Render / cloud Redis)
    url: process.env.REDIS_URL,
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 200, 5000);
      console.log(`⏳ Redis retry attempt ${times}, next in ${delay}ms`);
      return delay;
    },
  }
  : {
    // ✅ Local development fallback
    host: '127.0.0.1',
    port: 6379,
    db: 0,
  };

let redis;

if (process.env.REDIS_URL) {
  redis = new Redis(redisConfig);
  console.log("✅ Redis connected");
} else {
  console.log("⚠️ Redis disabled (no REDIS_URL)");
}

// Separate clients for pub/sub (required by Socket.IO Redis adapter)
const createPubClient = () =>
  process.env.REDIS_URL ? new Redis(redisConfig) : null;

const createSubClient = () =>
  process.env.REDIS_URL ? new Redis(redisConfig) : null;

// Connection event logging
redis.on('connect', () => console.log('🔴 Redis connected'));
redis.on('error', (err) => console.error('🔴 Redis error:', err.message));
redis.on('close', () => console.warn('🔴 Redis connection closed'));

// Graceful shutdown helper
const disconnectRedis = async () => {
  try {
    await redis.quit();
    console.log('🔴 Redis disconnected gracefully');
  } catch (err) {
    console.error('🔴 Redis disconnect error:', err.message);
    redis.disconnect();
  }
};

module.exports = {
  redis,
  redisConfig,
  createPubClient,
  createSubClient,
  disconnectRedis,
};
