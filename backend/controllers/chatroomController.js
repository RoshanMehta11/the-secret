const Chatroom = require('../models/Chatroom');
const chatroomService = require('../services/chatroomService');

// ─── Chatroom Controller ──────────────────────────────────────────

exports.createRoom = async (req, res) => {
  try {
    const { name, type, maxParticipants } = req.body;

    if (!name || !type) {
      return res.status(400).json({ success: false, message: 'Name and type are required' });
    }
    if (!['public', 'private'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Type must be public or private' });
    }
    if (!name.trim() || name.trim().length > 50) {
      return res.status(400).json({ success: false, message: 'Name must be 1-50 characters' });
    }

    const room = await chatroomService.createRoom(req.user._id.toString(), {
      name: name.trim().substring(0, 50),
      type,
      maxParticipants: Math.min(Math.max(parseInt(maxParticipants) || 50, 2), 50),
    });

    res.status(201).json({ success: true, room });
  } catch (err) {
    if (err.message === 'REDIS_UNAVAILABLE') {
      return res.status(503).json({ success: false, message: 'Chatrooms temporarily unavailable' });
    }
    console.error('createRoom error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to create room' });
  }
};

exports.getPublicRooms = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 12, 24);
    const result = await chatroomService.getPublicRooms(page, limit);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('getPublicRooms error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch rooms' });
  }
};

exports.findByCode = async (req, res) => {
  try {
    const { code } = req.params;
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ success: false, message: 'Code must be 6 digits' });
    }

    const room = await chatroomService.findByCode(code);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found or expired' });
    }

    res.json({ success: true, room });
  } catch (err) {
    console.error('findByCode error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to find room' });
  }
};

exports.getRoom = async (req, res) => {
  try {
    const room = await chatroomService.getRoomByRoomId(req.params.roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }
    res.json({ success: true, room });
  } catch (err) {
    console.error('getRoom error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch room' });
  }
};

exports.closeRoom = async (req, res) => {
  try {
    const chatroomNs = req.app.get('chatroomNs');
    await chatroomService.closeRoom(req.params.roomId, req.user._id.toString(), chatroomNs);
    res.json({ success: true, message: 'Room closed' });
  } catch (err) {
    if (err.message === 'NOT_ROOM_CREATOR') {
      return res.status(403).json({ success: false, message: 'Only the creator can close this room' });
    }
    if (err.message === 'ROOM_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }
    console.error('closeRoom error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to close room' });
  }
};
