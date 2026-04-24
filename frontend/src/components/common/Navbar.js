import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocketContext } from '../../context/SocketContext';
import NotifPanel from '../notifications/NotifPanel';

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const { unreadNotifs, connected } = useSocketContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [showNotifs, setShowNotifs] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="navbar">
      <div className="navbar-inner" style={{ maxWidth: 1200 }}>
        {/* Logo */}
        <Link to="/" className="navbar-logo">🔒 The Secret</Link>

        {/* Links */}
        <div className="navbar-links">
          <Link to="/" className={`btn btn-sm ${isActive('/') ? 'btn-primary' : 'btn-ghost'}`}>
            Feed
          </Link>

          {user ? (
            <>
              <Link to="/profile" className={`btn btn-sm ${isActive('/profile') ? 'btn-primary' : 'btn-ghost'}`}>
                Profile
              </Link>

              {/* Notification Bell */}
              <div style={{ position: 'relative' }}>
                <button
                  className="navbar-icon"
                  onClick={() => setShowNotifs(!showNotifs)}
                  title="Notifications"
                >
                  🔔
                  {unreadNotifs > 0 && (
                    <span className="navbar-badge anim-badge-bounce">
                      {unreadNotifs > 9 ? '9+' : unreadNotifs}
                    </span>
                  )}
                </button>
                {showNotifs && <NotifPanel onClose={() => setShowNotifs(false)} />}
              </div>

              {/* Connection status */}
              {connected && (
                <span className="presence-dot presence-online" title="Connected" style={{ marginLeft: -4, marginRight: 4 }} />
              )}

              {isAdmin && (
                <Link to="/admin" className={`btn btn-sm ${location.pathname.startsWith('/admin') ? 'btn-primary' : 'btn-ghost'}`}>
                  ⚙️ Admin
                </Link>
              )}

              <button onClick={handleLogout} className="btn btn-danger btn-sm">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">Login</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Sign Up</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
