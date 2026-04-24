const Post = require('../models/Post');
const Comment = require('../models/Comment');
const User = require('../models/User');
const ModerationAudit = require('../models/ModerationAudit');
const crypto = require('crypto');
const eventBus = require('../services/eventBus');
const moderationService = require('../services/moderationService');
const feedScoreService = require('../services/feedScoreService');

const hashIp = (ip) => crypto.createHash('sha256').update(ip + process.env.JWT_SECRET).digest('hex');

// @desc   Get all posts (public feed — ranked by feedScore)
// @route  GET /api/posts
exports.getPosts = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const cursor = req.query.cursor;
    const tag = req.query.tag;
    const mood = req.query.mood;
    const contentType = req.query.type;
    const sort = req.query.sort || 'ranked'; // 'ranked' | 'latest' | 'trending'

    const filter = {
      isHidden: false,
      isDeleted: false,
      moderationStatus: { $in: ['approved', 'pending'] },
    };
    if (tag) filter.tags = tag;
    if (mood) filter.mood = mood;
    if (contentType) filter.contentType = contentType;

    let sortOrder;
    let cursorFilter = {};

    switch (sort) {
      case 'trending':
        sortOrder = { engagementVelocity: -1, createdAt: -1 };
        // Only show posts from last 24h for trending
        filter.createdAt = { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) };
        break;

      case 'latest':
        sortOrder = { createdAt: -1, _id: -1 };
        if (cursor) {
          const { score: cursorDate, id: cursorId } = feedScoreService.parseCursor(cursor) || {};
          if (cursorDate && cursorId) {
            cursorFilter = {
              $or: [
                { createdAt: { $lt: new Date(cursorDate) } },
                { createdAt: new Date(cursorDate), _id: { $lt: cursorId } },
              ],
            };
          }
        }
        break;

      case 'ranked':
      default:
        sortOrder = { feedScore: -1, _id: -1 };
        if (cursor) {
          const parsed = feedScoreService.parseCursor(cursor);
          if (parsed) {
            cursorFilter = {
              $or: [
                { feedScore: { $lt: parsed.score } },
                { feedScore: parsed.score, _id: { $lt: parsed.id } },
              ],
            };
          }
        }
        break;
    }

    const combinedFilter = { ...filter, ...cursorFilter };

    const posts = await Post.find(combinedFilter)
      .sort(sortOrder)
      .limit(limit + 1) // Fetch 1 extra to determine hasMore
      .populate('author', 'username avatar')
      .lean();

    const hasMore = posts.length > limit;
    const resultPosts = hasMore ? posts.slice(0, limit) : posts;

    // Build next cursor
    let nextCursor = null;
    if (hasMore && resultPosts.length > 0) {
      const lastPost = resultPosts[resultPosts.length - 1];
      if (sort === 'latest') {
        nextCursor = feedScoreService.buildCursor(new Date(lastPost.createdAt).getTime(), lastPost._id);
      } else {
        nextCursor = feedScoreService.buildCursor(lastPost.feedScore, lastPost._id);
      }
    }

    const sanitized = resultPosts.map((p) => ({
      ...p,
      author: p.isAnonymous ? null : p.author,
      isLiked: req.user ? p.likes.some((id) => id.toString() === req.user._id.toString()) : false,
      likes: undefined,
    }));

    res.json({
      success: true,
      posts: sanitized,
      nextCursor,
      hasMore,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc   Get single post
// @route  GET /api/posts/:id
exports.getPost = async (req, res) => {
  try {
    const post = await Post.findOne({ _id: req.params.id, isDeleted: false })
      .populate('author', 'username avatar')
      .lean();
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    const result = {
      ...post,
      author: post.isAnonymous ? null : post.author,
      isLiked: req.user ? post.likes.some((id) => id.toString() === req.user?._id?.toString()) : false,
      likes: undefined,
    };
    res.json({ success: true, post: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc   Create post (with moderation pipeline)
// @route  POST /api/posts
exports.createPost = async (req, res) => {
  try {
    const { content, tags, isAnonymous, mood } = req.body;
    if (!content?.trim()) return res.status(400).json({ success: false, message: 'Content is required' });
    if (content.length > 2000) return res.status(400).json({ success: false, message: 'Post too long (max 2000 chars)' });

    const tagList = tags
      ? tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 5)
      : [];

    // ── Stage 1: Sync moderation pre-filter ──────────────────
    const preFilter = await moderationService.preFilter(content);

    if (!preFilter.passed) {
      // Content blocked by pre-filter — don't create the post
      return res.status(400).json({
        success: false,
        message: 'Content violates community guidelines.',
        moderationTriggered: true,
      });
    }

    // Create post with moderation status
    const post = await Post.create({
      content: content.trim(),
      contentType: 'text',
      mood: ['confession', 'rant', 'positive', 'random'].includes(mood) ? mood : 'random',
      tags: tagList,
      isAnonymous: req.user ? (isAnonymous !== false) : true,
      author: req.user?._id || null,
      ipHash: hashIp(req.ip),
      moderationStatus: 'pending',
    });

    // Calculate initial feed score
    const initialScore = feedScoreService.calculateScore(post);
    post.feedScore = initialScore;
    post.feedScoreUpdatedAt = new Date();
    await post.save();

    if (req.user) {
      await User.findByIdAndUpdate(req.user._id, { $inc: { postCount: 1 } });
    }

    // ── Stage 2: Async moderation classification ─────────────
    // Run asynchronously — don't make the user wait
    (async () => {
      try {
        const classification = await moderationService.classifyContent(content);
        const { decision, actionTaken } = moderationService.makeDecision(classification.scores);

        // Update post with moderation results
        await Post.findByIdAndUpdate(post._id, {
          moderationStatus: decision,
          moderationScores: classification.scores,
          moderatedAt: new Date(),
          moderatedBy: 'ai_classifier',
          ...(actionTaken === 'hidden' ? { isHidden: true } : {}),
        });

        // Create audit trail
        await ModerationAudit.create({
          targetType: 'post',
          targetId: post._id,
          content: content,
          stage1Result: {
            passed: preFilter.passed,
            triggers: preFilter.triggers,
            score: preFilter.score,
            latencyMs: preFilter.latencyMs,
          },
          stage2Result: {
            model: classification.model,
            scores: classification.scores,
            latencyMs: classification.latencyMs,
            error: classification.error,
          },
          decision,
          actionTaken,
        });

        // Notify author if action was taken
        if (decision === 'rejected' || decision === 'flagged') {
          eventBus.emitEvent('post:moderated', {
            postId: post._id.toString(),
            decision,
            authorId: post.author?.toString(),
          });
        }
      } catch (err) {
        console.error('Async moderation error:', err.message);
      }
    })();

    // Emit events
    eventBus.emitEvent('post:created', {
      postId: post._id.toString(),
      authorId: req.user?._id?.toString(),
      content: content.substring(0, 100), // Truncated for event
      tags: tagList,
      isAnonymous: post.isAnonymous,
    });

    res.status(201).json({ success: true, post });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc   Delete post (own or admin)
// @route  DELETE /api/posts/:id
exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    const isOwner = req.user && post.author?.toString() === req.user._id.toString();
    const isAdmin = req.user?.role === 'admin';
    if (!isOwner && !isAdmin) return res.status(403).json({ success: false, message: 'Not authorized' });

    post.isDeleted = true;
    await post.save();
    res.json({ success: true, message: 'Post deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc   Like / Unlike post
// @route  PUT /api/posts/:id/like
exports.toggleLike = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post || post.isDeleted) return res.status(404).json({ success: false, message: 'Post not found' });

    const uid = req.user._id;
    const liked = post.likes.includes(uid);
    if (liked) {
      post.likes.pull(uid);
      post.likesCount = Math.max(0, post.likesCount - 1);

      eventBus.emitEvent('post:unliked', {
        postId: post._id.toString(),
        unlikerId: uid.toString(),
        authorId: post.author?.toString(),
      });
    } else {
      post.likes.push(uid);
      post.likesCount += 1;

      eventBus.emitEvent('post:liked', {
        postId: post._id.toString(),
        likerId: uid.toString(),
        authorId: post.author?.toString(),
        likerUsername: req.user.username,
        likerAvatar: req.user.avatar,
      });
    }
    await post.save();

    // Recalculate feed score on engagement change
    feedScoreService.recalculateSingle(post._id).catch(() => {});

    res.json({ success: true, liked: !liked, likesCount: post.likesCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc   Get comments for a post
// @route  GET /api/posts/:id/comments
exports.getComments = async (req, res) => {
  try {
    const comments = await Comment.find({ post: req.params.id, isDeleted: false, isHidden: false })
      .sort({ createdAt: -1 })
      .populate('author', 'username avatar')
      .lean();

    const sanitized = comments.map((c) => ({
      ...c,
      author: c.isAnonymous ? null : c.author,
    }));
    res.json({ success: true, comments: sanitized });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc   Add comment (with moderation)
// @route  POST /api/posts/:id/comments
exports.addComment = async (req, res) => {
  try {
    const { content, isAnonymous } = req.body;
    if (!content?.trim()) return res.status(400).json({ success: false, message: 'Comment cannot be empty' });

    // Moderation pre-filter on comment content
    const preFilter = await moderationService.preFilter(content);
    if (!preFilter.passed) {
      return res.status(400).json({
        success: false,
        message: 'Comment violates community guidelines.',
        moderationTriggered: true,
      });
    }

    const post = await Post.findById(req.params.id);
    if (!post || post.isDeleted) return res.status(404).json({ success: false, message: 'Post not found' });

    const comment = await Comment.create({
      post: post._id,
      content: content.trim(),
      isAnonymous: req.user ? (isAnonymous !== false) : true,
      author: req.user?._id || null,
      ipHash: hashIp(req.ip),
    });

    post.commentsCount += 1;
    await post.save();

    // Recalculate feed score on engagement change
    feedScoreService.recalculateSingle(post._id).catch(() => {});

    // Emit event for notifications + analytics
    eventBus.emitEvent('post:commented', {
      postId: post._id.toString(),
      commentId: comment._id.toString(),
      commenterId: req.user?._id?.toString(),
      authorId: post.author?.toString(),
      commenterUsername: req.user?.username,
      commenterAvatar: req.user?.avatar,
    });

    res.status(201).json({ success: true, comment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc   Report a post
// @route  POST /api/posts/:id/report
exports.reportPost = async (req, res) => {
  try {
    const Report = require('../models/Report');
    const { reason, description } = req.body;
    if (!reason) return res.status(400).json({ success: false, message: 'Reason is required' });

    await Report.create({
      reporter: req.user?._id || null,
      targetType: 'post',
      targetId: req.params.id,
      reason,
      description,
    });

    await Post.findByIdAndUpdate(req.params.id, { $inc: { reportCount: 1 }, isReported: true });

    eventBus.emitEvent('post:reported', {
      postId: req.params.id,
      reporterId: req.user?._id?.toString(),
      reason,
    });

    res.json({ success: true, message: 'Report submitted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
