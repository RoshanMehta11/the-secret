import React, { useState, useEffect } from 'react';
import { chatAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useSocketContext } from '../../context/SocketContext';

export default function ConvoList({ onSelectConvo }) {
  const { user } = useAuth();
  const { isUserOnline } = useSocketContext();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    chatAPI.getConversations()
      .then(({ data }) => setConversations(data.conversations || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const timeAgo = (date) => {
    if (!date) return '';
    const diff = Date.now() - new Date(date);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  const myId = user?.id || user?._id;
  const filtered = conversations.filter((c) => {
    if (!search) return true;
    const other = c.participants?.find((p) => p._id !== myId);
    return other?.username?.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="convo-panel">
      <div className="convo-header">
        <h3>💬 Messages</h3>
      </div>
      <div className="convo-search">
        <input
          placeholder="Search conversations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="convo-list">
        {loading ? (
          <div className="spinner" style={{ padding: 20 }}><div className="spin" /></div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {search ? 'No conversations found' : 'No conversations yet'}
          </div>
        ) : (
          filtered.map((convo) => {
            const other = convo.participants?.find((p) => p._id !== myId);
            const online = other ? isUserOnline(other._id) : false;

            return (
              <div
                key={convo._id}
                className={`convo-item ${convo.unreadCount > 0 ? 'unread' : ''}`}
                onClick={() => onSelectConvo(convo)}
              >
                <div className="convo-avatar">
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: 'var(--surface-light)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '0.9rem',
                  }}>
                    {other?.username?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  {online && <span className="presence-dot presence-online anim-presence" />}
                </div>
                <div className="convo-info">
                  <div className="convo-name">{other?.username || 'User'}</div>
                  <div className="convo-preview">{convo.lastMessage || 'Start chatting...'}</div>
                </div>
                <div className="convo-meta">
                  <span className="convo-time">{timeAgo(convo.lastMessageAt)}</span>
                  {convo.unreadCount > 0 && (
                    <span className="convo-unread-badge">{convo.unreadCount}</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
