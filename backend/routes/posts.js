const express = require('express');
const router = express.Router();
const {
  getPosts, getPost, createPost, deletePost, toggleLike,
  getComments, addComment, reportPost
} = require('../controllers/postController');
const { protect, optionalAuth } = require('../middleware/auth');
const { postCreationLimiter } = require('../middleware/rateLimiter');

router.get('/', optionalAuth, getPosts);
router.get('/:id', optionalAuth, getPost);
router.post('/', optionalAuth, postCreationLimiter, createPost);
router.delete('/:id', protect, deletePost);
router.put('/:id/like', protect, toggleLike);
router.get('/:id/comments', optionalAuth, getComments);
router.post('/:id/comments', optionalAuth, addComment);
router.post('/:id/report', optionalAuth, reportPost);

module.exports = router;
