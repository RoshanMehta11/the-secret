const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { chatroomJoinLimiter, chatroomCreateLimiter } = require('../middleware/rateLimiter');
const ctrl = require('../controllers/chatroomController');

// ─── Chatroom Routes ──────────────────────────────────────────────

router.post('/', protect, chatroomCreateLimiter, ctrl.createRoom);
router.get('/public', protect, ctrl.getPublicRooms);
router.get('/join/:code', protect, chatroomJoinLimiter, ctrl.findByCode);
router.get('/:roomId', protect, ctrl.getRoom);
router.delete('/:roomId', protect, ctrl.closeRoom);

module.exports = router;
