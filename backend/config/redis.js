const Redis = require('ioredis');

// ─── Redis Client Configuration ──────────────────────────────────
// Used for: caching, rate limiting, presence, job queues, pub/sub

const redisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB) || 0,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 5000);
    console.log(`⏳ Redis retry attempt ${times}, next in ${delay}ms`);
    return delay;
  },
  reconnectOnError(err) {
    const targetErrors = ['READONLY', 'ECONNRESET'];
    return targetErrors.some((e) => err.message.includes(e));
  },
};

// Primary client for commands (get/set/incr etc.)
const redis = new Redis(redisConfig);

// Separate clients for pub/sub (required by Socket.IO Redis adapter)
const createPubClient = () => new Redis(redisConfig);
const createSubClient = () => new Redis(redisConfig);

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
