import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useChatroom } from '../../context/ChatroomContext';
import { chatroomAPI } from '../../utils/api';
import '../../styles/chatrooms.css';

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatCountdown(expiresAt) {
  const diff = new Date(expiresAt) - Date.now();
  if (diff <= 0) return 'Expired';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function ChatroomUI() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    connected, messages, participantCount, typingUsers,
    roomExpired, joinRoom, leaveRoom, sendMessage,
    handleTyping, sendTyping, connectNamespace, setCurrentRoom,
  } = useChatroom();

  const [room, setRoom] = useState(null);
  const [input, setInput] = useState('');
  const [countdown, setCountdown] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const userId = user?.id || user?._id;

  // Fetch room data & connect
  useEffect(() => {
    if (!roomId) return;

    const init = async () => {
      try {
        const { data } = await chatroomAPI.getRoom(roomId);
        if (data.success && data.room) {
          setRoom(data.room);
          setCurrentRoom(data.room);
          connectNamespace();
          // Small delay to ensure socket is ready
          setTimeout(() => joinRoom(roomId), 300);
        } else {
          navigate('/chatrooms');
        }
      } catch {
        navigate('/chatrooms');
      } finally {
        setLoading(false);
      }
    };

    init();

    return () => {
      leaveRoom(roomId);
      setCurrentRoom(null);
    };
  }, [roomId]); // eslint-disable-line

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Countdown timer
  useEffect(() => {
    if (!room?.expiresAt) return;
    const tick = () => setCountdown(formatCountdown(room.expiresAt));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [room?.expiresAt]);

  // Handle expiry — redirect after 3s
  useEffect(() => {
    if (roomExpired) {
      const timer = setTimeout(() => navigate('/chatrooms'), 3000);
      return () => clearTimeout(timer);
    }
  }, [roomExpired, navigate]);

  const handleSend = useCallback(() => {
    if (!input.trim() || !roomId) return;
    sendMessage(roomId, input);
    setInput('');
    sendTyping(roomId, false);
    inputRef.current?.focus();
  }, [input, roomId, sendMessage, sendTyping]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (e.target.value.trim()) {
      handleTyping(roomId);
    }
  };

  const handleCopyCode = () => {
    if (room?.code) {
      navigator.clipboard.writeText(room.code).catch(() => {});
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  const handleLeave = () => {
    leaveRoom(roomId);
    navigate('/chatrooms');
  };

  if (loading) {
    return <div className="spinner" style={{ marginTop: 80 }}><div className="spin" /></div>;
  }

  if (!room) {
    return (
      <div className="chatrooms-page" style={{ textAlign: 'center', paddingTop: 80 }}>
        <p>Room not found</p>
        <button className="btn btn-primary" onClick={() => navigate('/chatrooms')} style={{ marginTop: 16 }}>
          ← Back to Chatrooms
        </button>
      </div>
    );
  }

  const isWarning = room.expiresAt && (new Date(room.expiresAt) - Date.now()) < 3600000;
  const typingList = Array.from(typingUsers.values());

  return (
    <div className="chatroom-container" style={{ position: 'relative' }}>
      {/* ── Header ──────────────────────────────────── */}
      <div className="chatroom-header">
        <div className="chatroom-header-info">
          <button className="btn btn-ghost btn-sm" onClick={handleLeave}>← Back</button>
          <h2>{room.name}</h2>
          <span className="participant-badge">👥 {participantCount}</span>
        </div>
        <div className="chatroom-header-actions">
          {room.type === 'private' && room.code && (
            <div className="code-share" onClick={handleCopyCode} title="Click to copy code">
              🔑 <span className="code-share-value">{room.code}</span>
              {codeCopied && <span style={{ fontSize: '0.7rem', color: 'var(--success)' }}>✓</span>}
            </div>
          )}
          <div className={`chatroom-timer ${isWarning ? 'warning' : ''}`}>
            ⏱ {countdown}
          </div>
          {!connected && (
            <span className="badge badge-red">Disconnected</span>
          )}
        </div>
      </div>

      {/* ── Messages ────────────────────────────────── */}
      <div className="chatroom-messages">
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '48px 0' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>💬</div>
            <p>No messages yet. Say hello!</p>
          </div>
        )}

        {messages.map((msg) => {
          if (msg.type === 'system') {
            return <div key={msg.id} className="cr-system-msg">{msg.text}</div>;
          }

          const isOwn = msg.senderId === userId;
          return (
            <div key={msg.id || msg.seqId} className={`cr-msg ${isOwn ? 'own' : 'other'}`}>
              {!isOwn && <div className="cr-msg-sender">{msg.senderName}</div>}
              <div className="cr-msg-bubble">{msg.text}</div>
              <div className="cr-msg-time">{formatTime(msg.timestamp)}</div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Typing Indicator ─────────────────────────── */}
      <div className="cr-typing">
        {typingList.length > 0 && (
          <>
            <div className="cr-typing-dots">
              <span /><span /><span />
            </div>
            {typingList.length === 1
              ? `${typingList[0]} is typing...`
              : `${typingList.length} people typing...`}
          </>
        )}
      </div>

      {/* ── Input ────────────────────────────────────── */}
      <div className="chatroom-input">
        <input
          ref={inputRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          maxLength={500}
          disabled={roomExpired}
          autoFocus
        />
        <button
          className="chatroom-send-btn"
          onClick={handleSend}
          disabled={!input.trim() || roomExpired}
          title="Send"
        >
          ➤
        </button>
      </div>

      {/* ── Expiry Overlay ───────────────────────────── */}
      {roomExpired && (
        <div className="chatroom-expired-overlay">
          <div className="icon">⏰</div>
          <h3>Room Expired</h3>
          <p>This chatroom has ended. Redirecting...</p>
          <button className="btn btn-primary" onClick={() => navigate('/chatrooms')}>
            Back to Chatrooms
          </button>
        </div>
      )}
    </div>
  );
}
