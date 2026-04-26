const express = require('express');
const router = express.Router();
const { getProfile, updateProfile, changePassword, getMyPosts } = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const User = require('../models/User');

router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.put('/password', protect, changePassword);
router.get('/my-posts', protect, getMyPosts);

// @desc    Get public shareable profile data + URL
// @route   GET /api/users/:id/share
// @access  Public
router.get('/:id/share', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('username avatar createdAt bio postCount role');

    if (!user || user.isBanned) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // CLIENT_URL may be comma-separated (e.g., "http://localhost:3000,http://localhost:5000")
    // Use only the first URL (the frontend)
    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:3000').split(',')[0].trim();
    const profileUrl = `${clientUrl}/profile/${req.params.id}`;

    res.json({
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        avatar: user.avatar || null,
        bio: user.bio || null,
        postCount: user.postCount || 0,
        memberSince: user.createdAt,
      },
      profileUrl,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
