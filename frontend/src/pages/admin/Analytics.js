import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../utils/api';

export default function Analytics() {
  const [stats, setStats] = useState(null);
  const [modStats, setModStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      adminAPI.getStats().then(({ data }) => setStats(data.stats)),
      adminAPI.getModerationStats().then(({ data }) => setModStats(data.stats)),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner"><div className="spin" /></div>;

  const totalEngagement = (stats?.totalPosts || 0) + (stats?.totalComments || 0);

  // Activity heatmap data (simulated for now — would come from backend analytics)
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const generateHeat = (d, h) => {
    // Pseudo-random based on day/hour for demo
    const seed = (d * 24 + h + 7) * 13 % 100;
    return seed;
  };

  // Moderation funnel
  const modTotal = (modStats?.approved || 0) + (modStats?.flagged || 0) + (modStats?.rejected || 0) || 1;
  const modPcts = {
    approved: Math.round(((modStats?.approved || 0) / modTotal) * 100),
    flagged: Math.round(((modStats?.flagged || 0) / modTotal) * 100),
    rejected: Math.round(((modStats?.rejected || 0) / modTotal) * 100),
  };

  return (
    <div>
      <h2 style={{ fontWeight: 700, marginBottom: 'var(--gap-lg)' }}>📈 Platform Analytics</h2>

      {/* Key Metrics */}
      <div className="grid-4" style={{ marginBottom: 'var(--gap-xl)' }}>
        <div className="card stat-card">
          <div className="stat-value" style={{ color: 'var(--purple)' }}>{stats?.totalUsers || 0}</div>
          <div className="stat-label">Total Users</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value" style={{ color: 'var(--success)' }}>{stats?.onlineCount || 0}</div>
          <div className="stat-label">Online Now</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value" style={{ color: 'var(--info)' }}>{totalEngagement}</div>
          <div className="stat-label">Total Engagement</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value" style={{ color: 'var(--warning)' }}>{stats?.todayPosts || 0}</div>
          <div className="stat-label">Posts Today</div>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 'var(--gap-xl)' }}>
        {/* Activity Heatmap */}
        <div className="card">
          <h3 style={{ fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            🔥 Activity Heatmap
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '40px repeat(24, 1fr)', gap: 2, fontSize: '0.6rem' }}>
              <div />
              {hours.map((h) => (
                <div key={h} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  {h % 6 === 0 ? `${h}h` : ''}
                </div>
              ))}
              {days.map((day, d) => (
                <React.Fragment key={day}>
                  <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.7rem' }}>{day}</div>
                  {hours.map((h) => {
                    const heat = generateHeat(d, h);
                    const opacity = 0.1 + (heat / 100) * 0.9;
                    return (
                      <div
                        key={h}
                        style={{
                          aspectRatio: '1',
                          borderRadius: 2,
                          background: `rgba(124, 58, 237, ${opacity})`,
                          minWidth: 10,
                        }}
                        title={`${day} ${h}:00 — Activity: ${heat}%`}
                      />
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, fontSize: '0.7rem', color: 'var(--text-muted)', justifyContent: 'flex-end' }}>
            <span>Less</span>
            {[0.1, 0.3, 0.5, 0.7, 0.9].map((o) => (
              <div key={o} style={{ width: 12, height: 12, borderRadius: 2, background: `rgba(124, 58, 237, ${o})` }} />
            ))}
            <span>More</span>
          </div>
        </div>

        {/* Moderation Funnel */}
        <div className="card">
          <h3 style={{ fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            🤖 Moderation Funnel
          </h3>

          {/* Pie chart using conic-gradient */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{
              width: 120, height: 120, borderRadius: '50%',
              background: `conic-gradient(
                var(--success) 0% ${modPcts.approved}%,
                var(--warning) ${modPcts.approved}% ${modPcts.approved + modPcts.flagged}%,
                var(--danger) ${modPcts.approved + modPcts.flagged}% 100%
              )`,
              flexShrink: 0,
            }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--success)' }} />
                <span style={{ fontSize: '0.85rem' }}>Approved: {modStats?.approved || 0} ({modPcts.approved}%)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--warning)' }} />
                <span style={{ fontSize: '0.85rem' }}>Flagged: {modStats?.flagged || 0} ({modPcts.flagged}%)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--danger)' }} />
                <span style={{ fontSize: '0.85rem' }}>Rejected: {modStats?.rejected || 0} ({modPcts.rejected}%)</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Total Audited</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--purple)' }}>{modStats?.totalAudited || 0}</div>
          </div>
        </div>
      </div>

      {/* Platform Health */}
      <div className="card" style={{ marginBottom: 'var(--gap-lg)' }}>
        <h3 style={{ fontWeight: 700, marginBottom: 16 }}>🏥 Platform Health</h3>
        <div className="grid-3">
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Posts / User Ratio</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>
              {stats?.totalUsers > 0 ? (stats.totalPosts / stats.totalUsers).toFixed(1) : '0'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Comments / Post Ratio</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>
              {stats?.totalPosts > 0 ? (stats.totalComments / stats.totalPosts).toFixed(1) : '0'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Report Rate</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: stats?.pendingReports > 10 ? 'var(--danger)' : 'var(--success)' }}>
              {stats?.totalPosts > 0 ? ((stats.pendingReports / stats.totalPosts) * 100).toFixed(1) : '0'}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
