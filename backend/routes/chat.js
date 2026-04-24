const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  startConversation,
  startConversationFromPost,
  getConversations,
  getMessages,
  sendMessage,
  getPublicKey,
  uploadPublicKey,
  getUnreadCount,
} = require('../controllers/chatController');

// All chat routes require authentication
router.use(protect);

// Public key management
router.put('/pubkey', uploadPublicKey);
router.get('/users/:id/pubkey', getPublicKey);

// Unread count
router.get('/unread', getUnreadCount);

// Conversations
router.post('/conversations/from-post', startConversationFromPost); // Must be before :id routes
router.post('/conversations', startConversation);
router.get('/conversations', getConversations);

// Messages within a conversation
router.get('/conversations/:id/messages', getMessages);
router.post('/conversations/:id/messages', sendMessage);

module.exports = router;
