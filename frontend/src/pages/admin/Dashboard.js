import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminAPI } from '../../utils/api';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI.getStats().then(({ data }) => setStats(data.stats)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner"><div className="spin" /></div>;

  const cards = [
    { label: 'Total Users', value: stats?.totalUsers, color: '#7c3aed', icon: '👥' },
    { label: 'Online Now', value: stats?.onlineCount, color: '#10b981', icon: '🟢' },
    { label: 'Total Posts', value: stats?.totalPosts, color: '#3b82f6', icon: '📝' },
    { label: "Today's Posts", value: stats?.todayPosts, color: '#06b6d4', icon: '🆕' },
    { label: 'Comments', value: stats?.totalComments, color: '#f59e0b', icon: '💬' },
    { label: 'Pending Reports', value: stats?.pendingReports, color: '#ef4444', icon: '🚩' },
    { label: 'Moderation Queue', value: stats?.pendingModeration, color: '#f97316', icon: '🤖' },
    { label: 'Banned Users', value: stats?.bannedUsers, color: '#6b7280', icon: '🚫' },
  ];

  return (
    <div>
      <h2 style={{ fontWeight: 700, marginBottom: '1.5rem' }}>Dashboard Overview</h2>

      <div className="grid-4" style={{ marginBottom: 'var(--gap-xl)' }}>
        {cards.map((c) => (
          <div key={c.label} className="card stat-card">
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{c.icon}</div>
            <div className="stat-value" style={{ color: c.color }}>{c.value ?? '–'}</div>
            <div className="stat-label">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <h3 style={{ fontWeight: 700, marginBottom: 12 }}>Quick Actions</h3>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {stats?.pendingModeration > 0 && (
          <Link to="/admin/moderation" className="btn btn-danger btn-sm">
            🤖 Review {stats.pendingModeration} flagged posts
          </Link>
        )}
        {stats?.pendingReports > 0 && (
          <Link to="/admin/reports" className="btn btn-secondary btn-sm">
            🚩 {stats.pendingReports} pending reports
          </Link>
        )}
        <Link to="/admin/analytics" className="btn btn-ghost btn-sm">
          📈 View Analytics
        </Link>
      </div>
    </div>
  );
}
