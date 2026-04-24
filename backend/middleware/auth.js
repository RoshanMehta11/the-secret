const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');

// ─── Token Configuration ──────────────────────────────────────────
const ACCESS_TOKEN_EXPIRY = '15m';       // Short-lived access token
const REFRESH_TOKEN_EXPIRY = '7d';       // Long-lived refresh token
const REFRESH_TOKEN_BYTES = 64;          // Cryptographic random bytes

// In-memory store for refresh tokens (replace with Redis in production)
// Structure: Map<userId, Set<tokenHash>>
const refreshTokenStore = new Map();

// ─── Token Generation ─────────────────────────────────────────────

/**
 * Generate a short-lived JWT access token (15 minutes)
 * Carried in Authorization header, stateless verification
 */
const generateAccessToken = (userId) => {
  return jwt.sign(
    { id: userId, type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
};

/**
 * Generate a cryptographically random refresh token (7 days)
 * Stored as httpOnly cookie or returned to client
 * Server tracks a hash of it for one-time-use rotation
 */
const generateRefreshToken = () => {
  return crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
};

/**
 * Hash a refresh token for secure storage comparison
 */
const hashRefreshToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Generate both access + refresh tokens, store refresh hash
 */
const generateTokenPair = (userId) => {
  const accessToken = generateAccessToken(userId);
  const refreshToken = generateRefreshToken();
  const refreshHash = hashRefreshToken(refreshToken);

  // Store the refresh token hash
  if (!refreshTokenStore.has(userId.toString())) {
    refreshTokenStore.set(userId.toString(), new Set());
  }
  refreshTokenStore.get(userId.toString()).add(refreshHash);

  return { accessToken, refreshToken };
};

// ─── Token Validation & Lifecycle ─────────────────────────────────

/**
 * Validate a refresh token and rotate it (one-time use)
 * Returns new token pair if valid, null if invalid
 */
const rotateRefreshToken = (userId, oldRefreshToken) => {
  const oldHash = hashRefreshToken(oldRefreshToken);
  const userTokens = refreshTokenStore.get(userId.toString());

  if (!userTokens || !userTokens.has(oldHash)) {
    // Token not found — possibly stolen or already used
    // Security measure: invalidate ALL refresh tokens for this user
    refreshTokenStore.delete(userId.toString());
    return null;
  }

  // Remove old token (one-time use)
  userTokens.delete(oldHash);

  // Generate new pair
  return generateTokenPair(userId);
};

/**
 * Invalidate a specific refresh token (logout from one device)
 */
const revokeRefreshToken = (userId, refreshToken) => {
  const hash = hashRefreshToken(refreshToken);
  const userTokens = refreshTokenStore.get(userId.toString());
  if (userTokens) {
    userTokens.delete(hash);
    if (userTokens.size === 0) refreshTokenStore.delete(userId.toString());
  }
};

/**
 * Invalidate ALL refresh tokens for a user (logout everywhere / password change)
 */
const revokeAllRefreshTokens = (userId) => {
  refreshTokenStore.delete(userId.toString());
};

// ─── Express Middleware ───────────────────────────────────────────

/**
 * Protect routes — verifies access token from Authorization header
 */
const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return res.status(401).json({ success: false, message: 'Not authorized' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user || !req.user.isActive || req.user.isBanned) {
      return res.status(401).json({ success: false, message: 'Account suspended or inactive' });
    }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

/**
 * Optional auth — attaches user if token present, continues regardless
 */
const optionalAuth = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
    } catch {
      // Token invalid or expired — proceed without user
    }
  }
  next();
};

/**
 * Admin-only middleware
 */
const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

// ─── Legacy compatibility ─────────────────────────────────────────
// Keep `generateToken` for backward compatibility during migration
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });
};

module.exports = {
  protect,
  optionalAuth,
  adminOnly,
  generateToken,
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
};
