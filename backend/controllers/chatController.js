const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const Post = require('../models/Post');
const { v4: uuidv4 } = require('uuid');
const { redis } = require('../config/redis');
const eventBus = require('../services/eventBus');

const IDEMPOTENCY_TTL = 3600; // 1 hour

// @desc    Start conversation from a post (PRIVACY-PRESERVING)
//          Frontend sends postId only — backend resolves author internally.
//          The requester never learns the real identity of the post author.
// @route   POST /api/chat/conversations/from-post
// @access  Protected
exports.startConversationFromPost = async (req, res) => {
  try {
    const { postId } = req.body;
    if (!postId) {
      return res.status(400).json({ success: false, message: 'Post ID is required' });
    }

    // Fetch the post to get author (select author even though frontend never sees it)
    const post = await Post.findById(postId).select('author content mood isAnonymous isDeleted');
    if (!post || post.isDeleted) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Post must have a logged-in author to message
    if (!post.author) {
      return res.status(400).json({ success: false, message: 'Cannot message guest posts' });
    }

    // Cannot message yourself
    if (post.author.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'This is your own post' });
    }

    // Check if author is banned or inactive
    const author = await User.findById(post.author);
    if (!author || !author.isActive || author.isBanned) {
      return res.status(404).json({ success: false, message: 'User not available' });
    }

    // Check if conversation already exists between these two users
    let conversation = await Conversation.findOne({
      participants: { $all: [req.user._id, post.author] },
    }).populate('participants', 'username avatar publicKey');

    if (conversation) {
      return res.json({ success: true, conversation, isExisting: true });
    }

    // Create new conversation with post context
    const contentPreview = post.content ? post.content.substring(0, 150) : '';
    conversation = await Conversation.create({
      participants: [req.user._id, post.author],
      postContext: {
        postId: post._id,
        contentPreview,
        mood: post.mood || 'random',
      },
    });

    conversation = await Conversation.findById(conversation._id)
      .populate('participants', 'username avatar publicKey');

    res.status(201).json({ success: true, conversation, isExisting: false });
  } catch (err) {
    console.error('startConversationFromPost error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Start or get existing conversation with a user
// @route   POST /api/chat/conversations
// @access  Protected
exports.startConversation = async (req, res) => {
  try {
    const { recipientId } = req.body;
    if (!recipientId) {
      return res.status(400).json({ success: false, message: 'Recipient ID is required' });
    }
    if (recipientId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot start conversation with yourself' });
    }

    const recipient = await User.findById(recipientId);
    if (!recipient || !recipient.isActive || recipient.isBanned) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if conversation already exists between these two users
    let conversation = await Conversation.findOne({
      participants: { $all: [req.user._id, recipientId] },
    }).populate('participants', 'username avatar publicKey');

    if (conversation) {
      return res.json({ success: true, conversation });
    }

    // Create new conversation
    conversation = await Conversation.create({
      participants: [req.user._id, recipientId],
    });

    conversation = await Conversation.findById(conversation._id)
      .populate('participants', 'username avatar publicKey');

    res.status(201).json({ success: true, conversation });
  } catch (err) {
    console.error('startConversation error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get all my conversations
// @route   GET /api/chat/conversations
// @access  Protected
exports.getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
      isActive: true,
    })
      .populate('participants', 'username avatar publicKey')
      .sort({ lastMessageAt: -1 });

    // Get unread counts using readCursors (efficient: no per-message queries)
    const conversationsWithUnread = conversations.map((conv) => {
      const convObj = conv.toObject();
      const userCursor = conv.readCursors?.get(req.user._id.toString()) || 0;
      const unreadCount = Math.max(0, (conv.seqCounter || 0) - userCursor);
      return { ...convObj, unreadCount };
    });

    res.json({ success: true, conversations: conversationsWithUnread });
  } catch (err) {
    console.error('getConversations error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get messages for a conversation (cursor-based pagination using seqNum)
// @route   GET /api/chat/conversations/:id/messages
// @access  Protected
exports.getMessages = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    // Ensure user is a participant
    if (!conversation.participants.map(String).includes(req.user._id.toString())) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const afterSeq = parseInt(req.query.after_seq); // Cursor: fetch messages after this seqNum
    const beforeSeq = parseInt(req.query.before_seq); // Fetch messages before this seqNum

    const filter = { conversation: req.params.id };
    if (!isNaN(afterSeq)) {
      filter.seqNum = { $gt: afterSeq };
    } else if (!isNaN(beforeSeq)) {
      filter.seqNum = { $lt: beforeSeq };
    }

    const messages = await Message.find(filter)
      .sort({ seqNum: !isNaN(afterSeq) ? 1 : -1 }) // Ascending for cursor-forward, descending for initial/backward
      .limit(limit + 1) // Fetch 1 extra for hasMore
      .populate('sender', 'username avatar');

    const hasMore = messages.length > limit;
    const resultMessages = hasMore ? messages.slice(0, limit) : messages;

    // For initial load and backward pagination, we sorted descending (newest first)
    // Reverse to return in chronological order (oldest first → newest last)
    if (isNaN(afterSeq)) {
      resultMessages.reverse();
    }

    // Update read cursor for this user
    if (resultMessages.length > 0) {
      const maxSeqNum = Math.max(...resultMessages.map((m) => m.seqNum));
      const currentCursor = conversation.readCursors?.get(req.user._id.toString()) || 0;
      if (maxSeqNum > currentCursor) {
        await Conversation.findByIdAndUpdate(req.params.id, {
          [`readCursors.${req.user._id.toString()}`]: maxSeqNum,
        });
      }
    }

    res.json({
      success: true,
      messages: resultMessages,
      hasMore,
      seqCounter: conversation.seqCounter,
    });
  } catch (err) {
    console.error('getMessages error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Send an encrypted message (REST endpoint, with idempotency)
// @route   POST /api/chat/conversations/:id/messages
// @access  Protected
exports.sendMessage = async (req, res) => {
  try {
    const { ciphertext, iv, clientMsgId } = req.body;
    if (!ciphertext || !iv) {
      return res.status(400).json({ success: false, message: 'Encrypted message data required' });
    }

    const msgId = clientMsgId || uuidv4();

    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    if (!conversation.participants.map(String).includes(req.user._id.toString())) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // ── Idempotency check ─────────────────────────────────────
    try {
      const idempotencyKey = `chat:idempotency:${msgId}`;
      const existing = await redis.get(idempotencyKey);
      if (existing) {
        // Message already processed — return the existing one
        const existingMsg = await Message.findById(existing).populate('sender', 'username avatar');
        if (existingMsg) {
          return res.json({ success: true, message: existingMsg, deduplicated: true });
        }
      }
    } catch {
      // Redis unavailable — proceed without idempotency check
    }

    // ── Atomically increment sequence counter ─────────────────
    const updated = await Conversation.findByIdAndUpdate(
      req.params.id,
      { $inc: { seqCounter: 1 } },
      { new: true }
    );
    const seqNum = updated.seqCounter;

    // Create message
    const message = await Message.create({
      conversation: req.params.id,
      sender: req.user._id,
      ciphertext,
      iv,
      clientMsgId: msgId,
      seqNum,
      status: 'sent',
    });

    // Update conversation metadata
    conversation.lastMessage = '[Encrypted]';
    conversation.lastMessageAt = new Date();
    await conversation.save();

    // Store idempotency key
    try {
      await redis.set(`chat:idempotency:${msgId}`, message._id.toString(), 'EX', IDEMPOTENCY_TTL);
    } catch {
      // Redis unavailable — continue
    }

    const populated = await Message.findById(message._id)
      .populate('sender', 'username avatar');

    // Emit event for analytics
    const otherUserId = conversation.participants.find((p) => p.toString() !== req.user._id.toString());
    eventBus.emitEvent('message:sent', {
      messageId: message._id.toString(),
      conversationId: req.params.id,
      senderId: req.user._id.toString(),
      recipientId: otherUserId?.toString(),
    });

    res.status(201).json({
      success: true,
      message: populated,
      seqNum,
    });
  } catch (err) {
    // Handle duplicate clientMsgId (MongoDB unique constraint)
    if (err.code === 11000 && err.keyPattern?.clientMsgId) {
      const existing = await Message.findOne({ clientMsgId: req.body.clientMsgId || '' })
        .populate('sender', 'username avatar');
      if (existing) {
        return res.json({ success: true, message: existing, deduplicated: true });
      }
    }
    console.error('sendMessage error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get a user's public key for E2E key exchange
// @route   GET /api/chat/users/:id/pubkey
// @access  Protected
exports.getPublicKey = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('publicKey username');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (!user.publicKey) {
      return res.status(404).json({ success: false, message: 'User has no public key' });
    }
    res.json({ success: true, publicKey: user.publicKey, username: user.username });
  } catch (err) {
    console.error('getPublicKey error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Upload my public key
// @route   PUT /api/chat/pubkey
// @access  Protected
exports.uploadPublicKey = async (req, res) => {
  try {
    const { publicKey } = req.body;
    if (!publicKey) {
      return res.status(400).json({ success: false, message: 'Public key is required' });
    }
    await User.findByIdAndUpdate(req.user._id, { publicKey });
    res.json({ success: true, message: 'Public key uploaded' });
  } catch (err) {
    console.error('uploadPublicKey error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get total unread message count
// @route   GET /api/chat/unread
// @access  Protected
exports.getUnreadCount = async (req, res) => {
  try {
    // Use readCursors for efficient unread counting
    const conversations = await Conversation.find({
      participants: req.user._id,
      isActive: true,
    });

    let totalUnread = 0;
    for (const conv of conversations) {
      const cursor = conv.readCursors?.get(req.user._id.toString()) || 0;
      totalUnread += Math.max(0, (conv.seqCounter || 0) - cursor);
    }

    res.json({ success: true, unreadCount: totalUnread });
  } catch (err) {
    console.error('getUnreadCount error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
