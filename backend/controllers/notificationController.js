const Notification = require('../models/Notification');
const notificationService = require('../services/notificationService');

// @desc   Get notifications for current user
// @route  GET /api/notifications
// @access Protected
exports.getNotifications = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const page = parseInt(req.query.page) || 1;
    const unreadOnly = req.query.unread === 'true';

    const filter = { recipient: req.user._id };
    if (unreadOnly) filter.isRead = false;

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
    ]);

    res.json({
      success: true,
      notifications,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc   Get unread notification count (from Redis — O(1))
// @route  GET /api/notifications/unread-count
// @access Protected
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await notificationService.getUnreadCount(req.user._id.toString());
    res.json({ success: true, unreadCount: count });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc   Mark notifications as read (batch or all)
// @route  PUT /api/notifications/read
// @access Protected
exports.markAsRead = async (req, res) => {
  try {
    const { notificationIds, all } = req.body;

    if (all) {
      await notificationService.markAllAsRead(req.user._id.toString());
      return res.json({ success: true, message: 'All notifications marked as read' });
    }

    if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
      return res.status(400).json({ success: false, message: 'notificationIds required' });
    }

    const count = await notificationService.markAsRead(req.user._id.toString(), notificationIds);
    res.json({ success: true, markedCount: count });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
