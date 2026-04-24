const User = require('../models/User');
const Post = require('../models/Post');

// @desc   Get user profile
// @route  GET /api/users/profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password -googleId');
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc   Update profile
// @route  PUT /api/users/profile
exports.updateProfile = async (req, res) => {
  try {
    const { username, bio } = req.body;
    const user = await User.findById(req.user._id);

    if (username && username !== user.username) {
      const exists = await User.findOne({ username });
      if (exists) return res.status(400).json({ success: false, message: 'Username taken' });
      user.username = username;
    }
    if (bio !== undefined) user.bio = bio;

    await user.save();
    res.json({ success: true, user: { id: user._id, username: user.username, bio: user.bio, avatar: user.avatar } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc   Change password
// @route  PUT /api/users/password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');
    if (!user.password) return res.status(400).json({ success: false, message: 'Set password via account settings' });

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) return res.status(400).json({ success: false, message: 'Current password is incorrect' });

    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc   Get user's own posts
// @route  GET /api/users/my-posts
exports.getMyPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const posts = await Post.find({ author: req.user._id, isDeleted: false })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Post.countDocuments({ author: req.user._id, isDeleted: false });
    res.json({ success: true, posts, total });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
