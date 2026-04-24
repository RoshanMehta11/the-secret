const express = require('express');
const router = express.Router();
const { getProfile, updateProfile, changePassword, getMyPosts } = require('../controllers/userController');
const { protect } = require('../middleware/auth');

router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.put('/password', protect, changePassword);
router.get('/my-posts', protect, getMyPosts);

module.exports = router;
