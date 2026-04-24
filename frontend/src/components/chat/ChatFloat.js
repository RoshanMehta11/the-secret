import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocketContext } from '../../context/SocketContext';
import { useChatContext } from '../../context/ChatContext';
import ConvoList from './ConvoList';
import ChatWindow from './ChatWindow';
import '../../styles/chat.css';

/**
 * Floating Chat System
 * Anchored to bottom-right, overlays all pages.
 * Supports multiple open chat windows side-by-side.
 * Listens to ChatContext for externally-triggered conversations (e.g. from PostCard).
 */
export default function ChatFloat() {
  const { user } = useAuth();
  const { unreadMessages } = useSocketContext();
  const { pendingChat, consumePendingChat } = useChatContext();
  const [showConvos, setShowConvos] = useState(false);
  const [openChats, setOpenChats] = useState([]); // Array of conversation objects
  const [minimized, setMinimized] = useState(new Set());

  // Listen for externally-opened conversations (from PostCard "Start Conversation")
  useEffect(() => {
    if (!pendingChat) return;
    const convo = consumePendingChat();
    if (convo) handleSelectConvo(convo);
  }, [pendingChat]); // eslint-disable-line

  if (!user) return null;

  const handleSelectConvo = (convo) => {
    // Don't open duplicates
    if (openChats.some((c) => c._id === convo._id)) {
      // Unminimize if minimized
      setMinimized((prev) => {
        const next = new Set(prev);
        next.delete(convo._id);
        return next;
      });
      setShowConvos(false);
      return;
    }
    // Max 3 open windows
    const updated = [...openChats, convo].slice(-3);
    setOpenChats(updated);
    setShowConvos(false);
  };

  const handleCloseChat = (convId) => {
    setOpenChats((prev) => prev.filter((c) => c._id !== convId));
    setMinimized((prev) => {
      const next = new Set(prev);
      next.delete(convId);
      return next;
    });
  };

  const handleMinimize = (convId) => {
    setMinimized((prev) => {
      const next = new Set(prev);
      if (next.has(convId)) next.delete(convId);
      else next.add(convId);
      return next;
    });
  };

  return (
    <div className="chat-float">
      {/* Open chat windows */}
      {openChats.map((convo) => (
        !minimized.has(convo._id) && (
          <ChatWindow
            key={convo._id}
            conversation={convo}
            onClose={() => handleCloseChat(convo._id)}
            onMinimize={() => handleMinimize(convo._id)}
          />
        )
      ))}

      {/* Minimized chat bubbles */}
      {openChats.filter((c) => minimized.has(c._id)).map((convo) => {
        const other = convo.participants?.find((p) => p._id !== (user?.id || user?._id));
        return (
          <button
            key={convo._id}
            className="chat-fab"
            onClick={() => handleMinimize(convo._id)}
            title={other?.username || 'Chat'}
            style={{ width: 44, height: 44, fontSize: '0.9rem', marginBottom: 10 }}
          >
            {other?.username?.charAt(0)?.toUpperCase() || '?'}
          </button>
        );
      })}

      {/* Conversation list panel */}
      {showConvos && <ConvoList onSelectConvo={handleSelectConvo} />}

      {/* Chat FAB */}
      <button
        className="chat-fab"
        onClick={() => setShowConvos(!showConvos)}
        title="Messages"
      >
        💬
        {unreadMessages > 0 && (
          <span className="navbar-badge anim-badge-bounce">{unreadMessages > 9 ? '9+' : unreadMessages}</span>
        )}
      </button>
    </div>
  );
}
