import React, { useState, useEffect } from 'react';
import { notificationAPI } from '../utils/api';
import '../styles/notifications.css';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, unread

  useEffect(() => {
    setLoading(true);
    notificationAPI.getAll({ limit: 50, unread: filter === 'unread' ? 'true' : undefined })
      .then(({ data }) => setNotifications(data.notifications || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter]);

  const handleMarkAllRead = async () => {
    await notificationAPI.markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const timeAgo = (date) => {
    const diff = Date.now() - new Date(date);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="page">
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--gap-lg)' }}>
          <h1 className="page-title">🔔 Notifications</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter('all')}>All</button>
            <button className={`btn btn-sm ${filter === 'unread' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter('unread')}>Unread</button>
            <button className="btn btn-sm btn-ghost" onClick={handleMarkAllRead}>✓ Mark all read</button>
          </div>
        </div>

        {loading ? (
          <div className="spinner"><div className="spin" /></div>
        ) : notifications.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔕</div>
            <p>No notifications yet</p>
          </div>
        ) : (
          <div className="notif-page-list">
            {notifications.map((n) => (
              <div key={n._id} className={`notif-page-item ${!n.isRead ? 'unread' : ''}`}>
                <div style={{ fontSize: '1.5rem' }}>
                  {n.type?.includes('liked') ? '❤️' : n.type?.includes('comment') ? '💬' : n.type?.includes('message') ? '✉️' : '🔔'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{n.title || n.type?.replace(/_/g, ' ')}</div>
                  {n.body && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>{n.body}</div>}
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>{timeAgo(n.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
