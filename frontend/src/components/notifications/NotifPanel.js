import React, { useState, useEffect, useRef } from 'react';
import { useSocketContext } from '../../context/SocketContext';
import { notificationAPI } from '../../utils/api';
import '../../styles/notifications.css';

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'social', label: '❤️ Social' },
  { key: 'message', label: '💬 Messages' },
  { key: 'system', label: '⚙️ System' },
];

const SOCIAL_TYPES = ['post_liked', 'post_commented', 'comment_liked'];
const MESSAGE_TYPES = ['new_message', 'message_reaction'];
const SYSTEM_TYPES = ['user_banned', 'user_unbanned', 'role_changed', 'moderation_flag', 'post_hidden', 'system_announcement'];

function categorize(type) {
  if (SOCIAL_TYPES.includes(type)) return 'social';
  if (MESSAGE_TYPES.includes(type)) return 'message';
  if (SYSTEM_TYPES.includes(type)) return 'system';
  return 'social';
}

function getNotifIcon(type) {
  const cat = categorize(type);
  if (cat === 'social') return '❤️';
  if (cat === 'message') return '💬';
  return '⚙️';
}

export default function NotifPanel({ onClose }) {
  const { setUnreadNotifs } = useSocketContext();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const panelRef = useRef(null);

  useEffect(() => {
    notificationAPI.getAll({ limit: 20 })
      .then(({ data }) => setNotifications(data.notifications || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleMarkAllRead = async () => {
    try {
      await notificationAPI.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadNotifs(0);
    } catch {}
  };

  const filtered = notifications.filter((n) => {
    if (category === 'all') return true;
    return categorize(n.type) === category;
  });

  const timeAgo = (date) => {
    const diff = Date.now() - new Date(date);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  return (
    <div className="notif-panel" ref={panelRef}>
      <div className="notif-panel-header">
        <h3>Notifications</h3>
        <button className="btn btn-xs btn-ghost" onClick={handleMarkAllRead}>Mark all read</button>
      </div>

      <div className="notif-panel-tabs">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            className={`notif-tab ${category === cat.key ? 'active' : ''}`}
            onClick={() => setCategory(cat.key)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="notif-list">
        {loading ? (
          <div className="spinner" style={{ padding: 20 }}><div className="spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="notif-empty">
            🔔 No notifications yet
          </div>
        ) : (
          filtered.map((notif) => (
            <div key={notif._id} className={`notif-item ${!notif.isRead ? 'unread' : ''}`}>
              <div className={`notif-icon ${categorize(notif.type)}`}>
                {getNotifIcon(notif.type)}
              </div>
              <div className="notif-content">
                <div className="notif-title">{notif.title || notif.type.replace(/_/g, ' ')}</div>
                {notif.body && <div className="notif-body">{notif.body}</div>}
                <div className="notif-time">{timeAgo(notif.createdAt)}</div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="notif-panel-footer">
        <a href="/notifications" className="btn btn-xs btn-ghost" style={{ width: '100%', justifyContent: 'center' }}>
          View All Notifications
        </a>
      </div>
    </div>
  );
}
