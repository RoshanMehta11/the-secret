const rateLimit = require('express-rate-limit');

// ─── Rate Limiter Middleware ──────────────────────────────────────
// Multi-tier rate limiting: global, auth, post creation, API

// NOTE: In production with Redis, replace the default MemoryStore with:
//   const RedisStore = require('rate-limit-redis');
//   store: new RedisStore({ sendCommand: (...args) => redis.call(...args) })

// Global rate limit: 100 requests per minute per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
  keyGenerator: (req) => {
    // Use X-Forwarded-For if behind proxy, fallback to req.ip
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
  },
});

// Auth endpoints: 5 requests per minute per IP (brute force protection)
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again in 1 minute.',
  },
  skipSuccessfulRequests: false,
});

// Post creation: 10 posts per 5 minutes per user
const postCreationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many posts created. Please wait before posting again.',
  },
  keyGenerator: (req) => {
    // Rate limit by user ID if authenticated, otherwise by IP
    return req.user?._id?.toString() || req.ip;
  },
});

// API-heavy endpoints (search, feed): 30 requests per minute
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'API rate limit exceeded. Please slow down.',
  },
});

// ─── Chatroom Rate Limiters ──────────────────────────────────────

// Anti brute-force for private room codes: 10 attempts/min/IP
const chatroomJoinLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many join attempts. Please try again later.',
  },
});

// Room creation: 3 rooms per 10 minutes per user
const chatroomCreateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many rooms created. Please wait before creating more.',
  },
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
});

// ─── Socket.IO Rate Limiting ──────────────────────────────────────
// In-memory tracker for socket events (per socket, not per user)
const socketRateLimits = new Map();

/**
 * Rate-limit socket events: max `maxEvents` per `windowMs` per socket.
 * Returns true if the event should be BLOCKED.
 */
const checkSocketRateLimit = (socketId, maxEvents = 60, windowMs = 60000) => {
  const now = Date.now();
  let entry = socketRateLimits.get(socketId);

  if (!entry || now - entry.windowStart > windowMs) {
    // New window
    entry = { windowStart: now, count: 1 };
    socketRateLimits.set(socketId, entry);
    return false;
  }

  entry.count += 1;
  if (entry.count > maxEvents) {
    return true; // BLOCKED
  }
  return false;
};

/**
 * Clean up socket rate limit entry on disconnect.
 */
const cleanupSocketRateLimit = (socketId) => {
  socketRateLimits.delete(socketId);
};

module.exports = {
  globalLimiter,
  authLimiter,
  postCreationLimiter,
  apiLimiter,
  chatroomJoinLimiter,
  chatroomCreateLimiter,
  checkSocketRateLimit,
  cleanupSocketRateLimit,
};
