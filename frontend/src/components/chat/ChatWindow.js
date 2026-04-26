import React, { useState, useEffect, useRef } from 'react';
import { chatAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useSocketContext } from '../../context/SocketContext';
import { emitSocketEvent } from '../../utils/socket';
import { getMoodTheme } from '../../utils/moodEngine';
import MessageBubble from './MessageBubble';
import TypingDots from './TypingDots';

export default function ChatWindow({ conversation, onClose, onMinimize }) {
  const { user } = useAuth();
  const { socket, isUserOnline, typingUsers } = useSocketContext();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeout = useRef(null);

  const otherUser = conversation.participants?.find(
    (p) => p._id !== user?.id && p._id !== user?._id
  );
  const convId = conversation._id;
  const isOnline = otherUser ? isUserOnline(otherUser._id) : false;
  const isTyping = typingUsers.get(convId)?.size > 0;
  const postCtx = conversation.postContext;
  const postMood = postCtx?.mood ? getMoodTheme(postCtx.mood) : null;

  // Derive current user's ID once — handles both formats
  const myId = (user?.id || user?._id || '').toString();

  // Load messages
  useEffect(() => {
    setLoading(true);
    chatAPI.getMessages(convId, { limit: 50 })
      .then(({ data }) => {
        setMessages(data.messages || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [convId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Join socket room for real-time messages
  useEffect(() => {
    if (!socket) return;
    socket.emit('join_conversation', convId);
    return () => {
      socket.emit('leave_conversation', convId);
    };
  }, [socket, convId]);

  // Listen for new messages — handles BOTH channels with cleanup
  useEffect(() => {
    if (!socket) return;

    const handler = (msg) => {
      // Validate this message belongs to the current conversation
      const msgConvId = msg.conversationId || msg.conversation;
      if (msgConvId && msgConvId !== convId && msgConvId.toString() !== convId.toString()) return;

      // DEBUG: log actual message structure (remove in production)
      console.log('[MSG DEBUG] Received message:', {
        sender: msg.sender,
        senderId: msg.senderId,
        senderType: typeof msg.sender,
        convId: msgConvId,
      });

      setMessages((prev) => {
        // Deduplicate: check by _id OR clientMsgId
        const exists = prev.some(
          (m) => (m._id === msg._id) || (m.clientMsgId && m.clientMsgId === msg.clientMsgId)
        );
        if (exists) {
          // Replace optimistic message with confirmed server message
          return prev.map((m) =>
            (m._id === msg._id || (m.clientMsgId && m.clientMsgId === msg.clientMsgId))
              ? { ...msg, content: msg.content || msg.ciphertext, status: 'sent' }
              : m
          );
        }
        return [...prev, { ...msg, content: msg.content || msg.ciphertext }];
      });
    };

    // Listen to BOTH events — new_message (conv room) + receive_message (user room)
    socket.on('new_message', handler);
    socket.on('receive_message', handler);

    // CRITICAL: Clean up both listeners to prevent duplicates on re-render
    return () => {
      socket.off('new_message', handler);
      socket.off('receive_message', handler);
    };
  }, [socket, convId]);

  // Send message
  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput('');
    setSending(true);

    const clientMsgId = `client_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Optimistic message — use current user's ID as sender
    const optimistic = {
      _id: `temp_${Date.now()}`,
      clientMsgId,
      sender: { _id: myId },
      content: text,
      ciphertext: text,
      iv: 'none',
      status: 'sending',
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const { data } = await chatAPI.sendMessage(convId, {
        ciphertext: text,
        iv: 'plaintext',
        clientMsgId,
      });
      // Replace optimistic with confirmed server message
      setMessages((prev) =>
        prev.map((m) =>
          m._id === optimistic._id || m.clientMsgId === clientMsgId
            ? { ...data.message, content: text, status: 'sent' }
            : m
        )
      );
    } catch {
      // Mark as failed
      setMessages((prev) =>
        prev.map((m) => (m._id === optimistic._id ? { ...m, status: 'failed' } : m))
      );
    } finally {
      setSending(false);
    }
  };

  // Typing indicator
  const handleInputChange = (e) => {
    setInput(e.target.value);
    emitSocketEvent('typing', { conversationId: convId, isTyping: true });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      emitSocketEvent('typing', { conversationId: convId, isTyping: false });
    }, 2000);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-window">
      {/* Header */}
      <div className="chat-window-header">
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--surface-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', flexShrink: 0 }}>
          {otherUser?.username?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <div style={{ flex: 1 }}>
          <div className="chat-window-name">{otherUser?.username || 'User'}</div>
          {isOnline && <div className="chat-window-status">● Online</div>}
        </div>
        <div className="e2e-badge">🔒 E2E</div>
        <div className="chat-window-actions">
          <button className="chat-window-btn" onClick={onMinimize} title="Minimize">─</button>
          <button className="chat-window-btn" onClick={onClose} title="Close">✕</button>
        </div>
      </div>

      {/* Post Context Banner */}
      {postCtx?.contentPreview && (
        <div className="chat-post-context" style={{
          padding: '10px 16px', borderBottom: '1px solid var(--border)',
          background: postMood ? postMood.bg : 'var(--bg-tertiary)',
          borderLeft: `3px solid ${postMood ? postMood.border : 'var(--purple)'}`,
          fontSize: '0.78rem', lineHeight: 1.5,
        }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            🔗 Replying to a post {postMood && <span style={{ color: postMood.accent }}>{postMood.emoji}</span>}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
            "{postCtx.contentPreview.length > 100 ? postCtx.contentPreview.slice(0, 100) + '...' : postCtx.contentPreview}"
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="chat-messages">
        {loading ? (
          <div className="spinner" style={{ padding: 20 }}><div className="spin" /></div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            👋 Start a conversation!
          </div>
        ) : (
          messages.map((msg) => {
            // Safe sender ID extraction — handles ALL possible formats:
            // 1. Populated object: { _id: "...", username: "..." }
            // 2. Raw ObjectId string: "abc123"
            // 3. Alternative field: msg.senderId
            const senderIdStr = (
              msg.sender?._id?.toString() ||
              (typeof msg.sender === 'string' ? msg.sender : '') ||
              msg.senderId?.toString() ||
              ''
            );
            const isOwn = senderIdStr === myId;
            return (
              <MessageBubble
                key={msg._id}
                message={msg}
                isOwn={isOwn}
              />
            );
          })
        )}
        {isTyping && (
          <div className="msg-bubble msg-other" style={{ padding: '4px 10px' }}>
            <TypingDots />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <textarea
          className="chat-input"
          placeholder="Type a message..."
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        <button
          className="chat-send"
          onClick={handleSend}
          disabled={!input.trim() || sending}
        >
          ➤
        </button>
      </div>
    </div>
  );
}
