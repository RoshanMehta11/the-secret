const User = require('../models/User');
const {
  generateToken,
  generateTokenPair,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
} = require('../middleware/auth');
const { OAuth2Client } = require('google-auth-library');
const eventBus = require('../services/eventBus');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// @desc   Register user
// @route  POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'Email already in use' });

    const user = await User.create({ username, email, password });

    // Generate dual token pair (access + refresh)
    const { accessToken, refreshToken } = await generateTokenPair(user._id);

    eventBus.emitEvent('activity', { type: 'login', userId: user._id.toString(), timestamp: Date.now() });

    res.status(201).json({
      success: true,
      accessToken,
      refreshToken,
      // Legacy field for backward compatibility
      token: accessToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc   Login user
// @route  POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password required' });

    const user = await User.findOne({ email }).select('+password');
    if (!user || !user.password)
      return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    if (user.isBanned) return res.status(403).json({ success: false, message: 'Account banned: ' + user.banReason });

    user.lastLogin = Date.now();
    await user.save();

    // Generate dual token pair
    const { accessToken, refreshToken } = await generateTokenPair(user._id);

    eventBus.emitEvent('activity', { type: 'login', userId: user._id.toString(), timestamp: Date.now() });

    res.json({
      success: true,
      accessToken,
      refreshToken,
      token: accessToken, // Legacy
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc   Google OAuth login
// @route  POST /api/auth/google
exports.googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const { sub: googleId, email, name, picture } = ticket.getPayload();

    let user = await User.findOne({ $or: [{ googleId }, { email }] });
    if (!user) {
      user = await User.create({ googleId, email, username: name, avatar: picture });
    } else if (!user.googleId) {
      user.googleId = googleId;
      user.avatar = picture || user.avatar;
      await user.save();
    }

    if (user.isBanned) return res.status(403).json({ success: false, message: 'Account banned' });

    user.lastLogin = Date.now();
    await user.save();

    const { accessToken, refreshToken } = await generateTokenPair(user._id);

    eventBus.emitEvent('activity', { type: 'login', userId: user._id.toString(), timestamp: Date.now() });

    res.json({
      success: true,
      accessToken,
      refreshToken,
      token: accessToken, // Legacy
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Google authentication failed' });
  }
};

// @desc   Get current user
// @route  GET /api/auth/me
exports.getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};

// @desc   Refresh access token
// @route  POST /api/auth/refresh
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken, userId } = req.body;
    if (!refreshToken || !userId) {
      return res.status(400).json({ success: false, message: 'Refresh token and userId required' });
    }

    // Verify user exists and is active
    const user = await User.findById(userId);
    if (!user || !user.isActive || user.isBanned) {
      return res.status(401).json({ success: false, message: 'Account invalid' });
    }

    // Rotate refresh token (one-time use)
    const newTokens = await rotateRefreshToken(userId, refreshToken);
    if (!newTokens) {
      // Token reuse detected — all sessions invalidated
      return res.status(401).json({
        success: false,
        message: 'Refresh token invalid or reused. All sessions invalidated for security.',
        code: 'TOKEN_FAMILY_REVOKED',
      });
    }

    res.json({
      success: true,
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
      token: newTokens.accessToken, // Legacy
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc   Logout (invalidate refresh token)
// @route  POST /api/auth/logout
exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken && req.user) {
      await revokeRefreshToken(req.user._id, refreshToken);
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc   Logout from all devices
// @route  POST /api/auth/logout-all
exports.logoutAll = async (req, res) => {
  try {
    await revokeAllRefreshTokens(req.user._id);
    res.json({ success: true, message: 'Logged out from all devices' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
