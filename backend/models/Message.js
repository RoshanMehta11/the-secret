const mongoose = require('mongoose');

// ─── Enhanced Message Schema ──────────────────────────────────────
// Supports E2E encryption, delivery guarantees, idempotency,
// and ordered message delivery via sequence numbers.

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // E2E encrypted content — server NEVER sees plaintext
    ciphertext: {
      type: String,
      required: true,
    },
    iv: {
      type: String,
      required: true,
    },

    // ── Ordering & Idempotency (Phase 2) ──────────────────────
    // Client-generated UUID for idempotent message sending
    clientMsgId: {
      type: String,
      required: true,
      unique: true,
    },
    // Server-assigned monotonic sequence number per conversation
    seqNum: {
      type: Number,
      required: true,
    },

    // ── Tri-state delivery status (Phase 2) ───────────────────
    // Replaces the old binary `read` field
    status: {
      type: String,
      enum: ['sent', 'delivered', 'seen'],
      default: 'sent',
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    seenAt: {
      type: Date,
      default: null,
    },

    // ── Message type for extensibility ────────────────────────
    messageType: {
      type: String,
      enum: ['text', 'system', 'key_exchange'],
      default: 'text',
    },
  },
  { timestamps: true }
);

// Compound index for ordered retrieval within a conversation
messageSchema.index({ conversation: 1, seqNum: 1 });

// Reverse order for fetching latest messages
messageSchema.index({ conversation: 1, seqNum: -1 });

// Auto-delete messages after 7 days (ephemeral messaging)
messageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

// Idempotency lookup — prevents duplicate messages on retry
messageSchema.index({ clientMsgId: 1 }, { unique: true });

module.exports = mongoose.model('Message', messageSchema);
