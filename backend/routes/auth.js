const express = require('express');
const router = express.Router();
const {
  register, login, googleLogin, getMe,
  refreshToken, logout, logoutAll,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

// Public auth routes (with strict rate limiting)
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/google', authLimiter, googleLogin);
router.post('/refresh', refreshToken); // No auth needed, uses refresh token

// Protected routes
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);
router.post('/logout-all', protect, logoutAll);

module.exports = router;
