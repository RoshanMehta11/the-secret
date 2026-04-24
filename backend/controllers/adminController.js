const User = require('../models/User');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Report = require('../models/Report');
const ModerationAudit = require('../models/ModerationAudit');
const Notification = require('../models/Notification');
const eventBus = require('../services/eventBus');
const moderationService = require('../services/moderationService');
const presenceService = require('../services/presenceService');

// @desc   Get dashboard stats (with online count from Redis)
// @route  GET /api/admin/stats
exports.getStats = async (req, res) => {
  try {
    const [totalUsers, totalPosts, totalComments, pendingReports, bannedUsers, todayPosts, pendingModeration, onlineCount] =
      await Promise.all([
        User.countDocuments({ role: 'user' }),
        Post.countDocuments({ isDeleted: false }),
        Comment.countDocuments({ isDeleted: false }),
        Report.countDocuments({ status: 'pending' }),
        User.countDocuments({ isBanned: true }),
        Post.countDocuments({
          isDeleted: false,
          createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        }),
        Post.countDocuments({ moderationStatus: 'flagged' }),
        presenceService.getOnlineCount().catch(() => 0),
      ]);

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalPosts,
        totalComments,
        pendingReports,
        bannedUsers,
        todayPosts,
        pendingModeration,
        onlineCount,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc   Get all users
// @route  GET /api/admin/users
exports.getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const filter = req.query.filter; // banned, active

    const query = {};
    if (search) query.$or = [{ username: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }];
    if (filter === 'banned') query.isBanned = true;
    if (filter === 'active') query.isBanned = false;

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await User.countDocuments(query);
    res.json({ success: true, users, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc   Ban/unban user (with notification event)
// @route  PUT /api/admin/users/:id/ban
exports.toggleBan = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'admin') return res.status(403).json({ success: false, message: 'Cannot ban admin' });

    user.isBanned = !user.isBanned;
    user.banReason = user.isBanned ? (req.body.reason || 'Violation of terms') : '';
    await user.save();

    // Emit event for notification service
    if (user.isBanned) {
      eventBus.emitEvent('user:banned', {
        userId: user._id.toString(),
        reason: user.banReason,
        bannedBy: req.user._id.toString(),
      });
    } else {
      eventBus.emitEvent('user:unbanned', {
        userId: user._id.toString(),
        unbannedBy: req.user._id.toString(),
      });
    }

    res.json({ success: true, isBanned: user.isBanned, message: user.isBanned ? 'User banned' : 'User unbanned' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc   Change user role (with notification event)
// @route  PUT /api/admin/users/:id/role
exports.changeRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) return res.status(400).json({ success: false, message: 'Invalid role' });

    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    eventBus.emitEvent('user:role_changed', {
      userId: user._id.toString(),
      newRole: role,
      changedBy: req.user._id.toString(),
    });

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc   Get all posts (admin view — includes moderation status)
// @route  GET /api/admin/posts
exports.getPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const filter = req.query.filter; // reported, hidden, flagged

    const query = { isDeleted: false };
    if (filter === 'reported') query.isReported = true;
    if (filter === 'hidden') query.isHidden = true;
    if (filter === 'flagged') query.moderationStatus = 'flagged';

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('author', 'username email');

    const total = await Post.countDocuments(query);
    res.json({ success: true, posts, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc   Hide/unhide post
// @route  PUT /api/admin/posts/:id/hide
exports.toggleHidePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    post.isHidden = !post.isHidden;
    await post.save();
    res.json({ success: true, isHidden: post.isHidden });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc   Delete post (hard admin delete)
// @route  DELETE /api/admin/posts/:id
exports.deletePost = async (req, res) => {
  try {
    await Post.findByIdAndUpdate(req.params.id, { isDeleted: true });
    res.json({ success: true, message: 'Post deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc   Get all reports
// @route  GET /api/admin/reports
exports.getReports = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status || 'pending';

    const reports = await Report.find({ status })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('reporter', 'username email')
      .populate('reviewedBy', 'username');

    const total = await Report.countDocuments({ status });
    res.json({ success: true, reports, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc   Update report status
// @route  PUT /api/admin/reports/:id
exports.updateReport = async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { status, adminNote, reviewedBy: req.user._id, reviewedAt: Date.now() },
      { new: true }
    );
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Moderation Queue Endpoints ──────────────────────────────────

// @desc   Get flagged content awaiting review
// @route  GET /api/admin/moderation/queue
exports.getModerationQueue = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const posts = await Post.find({ moderationStatus: 'flagged', isDeleted: false })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('author', 'username email');

    const total = await Post.countDocuments({ moderationStatus: 'flagged', isDeleted: false });
    res.json({ success: true, posts, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc   Human review decision on moderated content
// @route  PUT /api/admin/moderation/:id/review
exports.reviewModeration = async (req, res) => {
  try {
    const { decision, note } = req.body;
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'Decision must be approved or rejected' });
    }

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    post.moderationStatus = decision;
    post.moderatedAt = new Date();
    post.moderatedBy = 'human_admin';
    if (decision === 'rejected') {
      post.isHidden = true;
    }
    await post.save();

    // Update audit trail
    await ModerationAudit.findOneAndUpdate(
      { targetType: 'post', targetId: post._id },
      {
        humanReviewer: req.user._id,
        humanDecision: decision,
        humanReviewedAt: new Date(),
        humanNote: note || '',
      }
    );

    // Notify author
    eventBus.emitEvent('post:moderated', {
      postId: post._id.toString(),
      decision,
      authorId: post.author?.toString(),
    });

    res.json({ success: true, post });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc   Get moderation stats
// @route  GET /api/admin/moderation/stats
exports.getModerationStats = async (req, res) => {
  try {
    const [approved, flagged, rejected, total] = await Promise.all([
      Post.countDocuments({ moderationStatus: 'approved' }),
      Post.countDocuments({ moderationStatus: 'flagged' }),
      Post.countDocuments({ moderationStatus: 'rejected' }),
      ModerationAudit.countDocuments(),
    ]);

    res.json({
      success: true,
      stats: { approved, flagged, rejected, totalAudited: total },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc   Update word blocklist
// @route  PUT /api/admin/moderation/blocklist
exports.updateBlocklist = async (req, res) => {
  try {
    const { add, remove } = req.body;
    if (add?.length) await moderationService.addToBlocklist(add);
    if (remove?.length) await moderationService.removeFromBlocklist(remove);

    const blocklist = await moderationService.getBlocklist();
    res.json({ success: true, blocklist });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
