import React from 'react';
import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const links = [
  { to: '/admin', label: '📊 Dashboard', end: true },
  { to: '/admin/users', label: '👥 Users' },
  { to: '/admin/posts', label: '📝 Posts' },
  { to: '/admin/reports', label: '🚩 Reports' },
  { to: '/admin/moderation', label: '🤖 Moderation' },
  { to: '/admin/analytics', label: '📈 Analytics' },
];

export default function AdminLayout() {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return <div className="spinner"><div className="spin" /></div>;
  if (!user || !isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">⚙️ Admin Panel</h1>
          <p className="page-subtitle">Manage The Secret platform</p>
        </div>
        <div className="layout-sidebar">
          <aside className="sidebar card">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                {l.label}
              </NavLink>
            ))}
          </aside>
          <main>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
