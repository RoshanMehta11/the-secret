const express = require('express');
const router = express.Router();
const {
  getStats, getUsers, toggleBan, changeRole,
  getPosts, toggleHidePost, deletePost,
  getReports, updateReport,
  getModerationQueue, reviewModeration, getModerationStats, updateBlocklist,
} = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/auth');

router.use(protect, adminOnly);

// Dashboard
router.get('/stats', getStats);

// User management
router.get('/users', getUsers);
router.put('/users/:id/ban', toggleBan);
router.put('/users/:id/role', changeRole);

// Post management
router.get('/posts', getPosts);
router.put('/posts/:id/hide', toggleHidePost);
router.delete('/posts/:id', deletePost);

// Reports
router.get('/reports', getReports);
router.put('/reports/:id', updateReport);

// Moderation pipeline
router.get('/moderation/queue', getModerationQueue);
router.put('/moderation/:id/review', reviewModeration);
router.get('/moderation/stats', getModerationStats);
router.put('/moderation/blocklist', updateBlocklist);

module.exports = router;
