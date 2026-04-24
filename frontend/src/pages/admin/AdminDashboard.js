import React, { useEffect, useState } from 'react';
import { adminAPI } from '../../utils/api';
import './Admin.css';

const AdminDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI
      .getStats()
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex-center" style={{ padding: '60px' }}><div className="spinner" /></div>;

  const { stats, recentPosts, recentUsers } = data;

  return (
    <div>
      <h2 className="page-title">Dashboard</h2>

      <div className="stats-grid">
        {[
          { label: 'Total Users', value: stats.totalUsers, icon: '👥' },
          { label: 'Total Posts', value: stats.totalPosts, icon: '📝' },
          { label: 'Pending Reports', value: stats.pendingReports, icon: '🚩' },
          { label: 'Banned Users', value: stats.bannedUsers, icon: '🚫' },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
            <div className="stat-number">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div className="card">
          <h3 className="admin-section-title">Recent Posts</h3>
          {recentPosts.length === 0 ? <p className="text-muted">No posts yet</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recentPosts.map((p) => (
                <div key={p._id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                  <p style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 4 }}>
                    {p.content.substring(0, 80)}{p.content.length > 80 ? '...' : ''}
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span className="badge badge-primary">{p.category}</span>
                    <span className="text-muted">{new Date(p.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="admin-section-title">Recent Users</h3>
          {recentUsers.length === 0 ? <p className="text-muted">No users yet</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recentUsers.map((u) => (
                <div key={u._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600 }}>@{u.username}</p>
                    <p className="text-muted">{u.email}</p>
                  </div>
                  {u.isBanned && <span className="badge badge-danger">Banned</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
