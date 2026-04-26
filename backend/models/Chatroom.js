const mongoose = require('mongoose');

// ─── Chatroom Schema ──────────────────────────────────────────────
// Stores room METADATA only. Messages are ephemeral (Redis buffer).
// Participants are tracked in Redis Sets for O(1) join/leave.

const chatroomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    maxlength: 50,
    trim: true,
  },
  type: {
    type: String,
    enum: ['public', 'private'],
    required: true,
  },
  code: {
    type: String,
    sparse: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['created', 'active', 'idle', 'expired'],
    default: 'created',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  maxParticipants: {
    type: Number,
    default: 50,
    min: 2,
    max: 50,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true,
  },
  lastActivity: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// TTL index — MongoDB auto-deletes documents after expiresAt
// (backup cleanup; primary cleanup is our cron + Redis)
chatroomSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for public room listing queries
chatroomSchema.index({ type: 1, status: 1, lastActivity: -1 });

module.exports = mongoose.model('Chatroom', chatroomSchema);
