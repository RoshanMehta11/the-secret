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

  // Listen for new messages in this conversation
  useEffect(() => {
    if (!socket) return;
    const handler = (msg) => {
      if (msg.conversationId === convId || msg.conversation === convId) {
        // Deduplicate: don't add if we already have it (from optimistic update)
        setMessages((prev) => {
          const exists = prev.some(
            (m) => (m._id === msg._id) || (m.clientMsgId && m.clientMsgId === msg.clientMsgId)
          );
          if (exists) {
            // Update the existing message (replace optimistic with confirmed)
            return prev.map((m) =>
              (m._id === msg._id || (m.clientMsgId && m.clientMsgId === msg.clientMsgId))
                ? { ...msg, content: msg.content || msg.ciphertext, status: 'sent' }
                : m
            );
          }
          return [...prev, { ...msg, content: msg.content || msg.ciphertext }];
        });
      }
    };
    socket.on('new_message', handler);
    return () => socket.off('new_message', handler);
  }, [socket, convId]);

  // Send message
  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput('');
    setSending(true);

    // Optimistic message
    const optimistic = {
      _id: `temp_${Date.now()}`,
      sender: { _id: user.id || user._id },
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
      });
      // Replace optimistic with real
      setMessages((prev) =>
        prev.map((m) => (m._id === optimistic._id ? { ...data.message, content: text, status: 'sent' } : m))
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

  const myId = user?.id || user?._id;

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

      {/* Post Context Banner — shows when conversation was started from a post */}
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
            const senderId = (msg.sender?._id || msg.sender || '').toString();
            const isOwn = senderId === myId;
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
