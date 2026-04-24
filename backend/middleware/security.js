const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const compression = require('compression');

// ─── Security Middleware Stack ────────────────────────────────────
// Applied in order: helmet → sanitize → hpp → compression

/**
 * Helmet: Sets 15+ secure HTTP headers
 * - CSP, HSTS, X-Frame-Options, X-Content-Type-Options, etc.
 */
const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Required for some React setups
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'ws:', 'wss:'],
    },
  },
  crossOriginEmbedderPolicy: false, // Required for loading external resources
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});

/**
 * MongoDB Sanitization: Prevents NoSQL injection
 * Strips $ and . from user input to block queries like { $gt: "" }
 */
const mongoSanitizeMiddleware = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ key, req }) => {
    console.warn(`🛡️ Sanitized key "${key}" in request from ${req.ip}`);
  },
});

/**
 * HPP: Prevents HTTP Parameter Pollution
 * Picks the last value when duplicate query params are sent
 */
const hppMiddleware = hpp({
  whitelist: [
    'tags', // Allow multiple tags in query: ?tags=funny&tags=serious
  ],
});

/**
 * Compression: gzip/deflate response compression
 * Only compress responses > 1KB, skip WebSocket upgrades
 */
const compressionMiddleware = compression({
  level: 6, // Balance compression ratio vs CPU
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    // Don't compress WebSocket upgrade requests
    if (req.headers['upgrade'] === 'websocket') return false;
    return compression.filter(req, res);
  },
});

/**
 * Custom XSS sanitizer middleware
 * Strips common XSS patterns from request body, query, and params
 */
const xssSanitize = (req, res, next) => {
  const clean = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        cleaned[key] = value
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
          .replace(/javascript\s*:/gi, '')
          .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        cleaned[key] = clean(value);
      } else {
        cleaned[key] = value;
      }
    }
    return cleaned;
  };

  if (req.body) req.body = clean(req.body);
  if (req.query) req.query = clean(req.query);
  if (req.params) req.params = clean(req.params);
  next();
};

/**
 * Strict CORS options generator
 */
const getCorsOptions = () => {
  const allowedOrigins = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(',').map((s) => s.trim().replace(/\/+$/, ''))
    : ['http://localhost:3000'];

  return {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      // Normalize origin by stripping trailing slashes before comparison
      const normalizedOrigin = origin.replace(/\/+$/, '');
      if (allowedOrigins.includes(normalizedOrigin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: Origin ${origin} not allowed`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
    maxAge: 86400, // Cache preflight for 24h
  };
};

module.exports = {
  helmetMiddleware,
  mongoSanitizeMiddleware,
  hppMiddleware,
  compressionMiddleware,
  xssSanitize,
  getCorsOptions,
};
