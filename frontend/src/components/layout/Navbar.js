import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="navbar">
      <div className="nav-inner">
        <Link to="/" className="nav-logo">
          🔒 <span>The Secret</span>
        </Link>

        <div className={`nav-links ${menuOpen ? 'open' : ''}`}>
          <Link to="/" onClick={() => setMenuOpen(false)}>Feed</Link>
          {user ? (
            <>
              <Link to="/profile" onClick={() => setMenuOpen(false)}>Profile</Link>
              {isAdmin && (
                <Link to="/admin" className="admin-link" onClick={() => setMenuOpen(false)}>
                  ⚙️ Admin
                </Link>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => { logout(); setMenuOpen(false); }}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login">Login</Link>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => { navigate('/register'); setMenuOpen(false); }}
              >
                Sign Up
              </button>
            </>
          )}
        </div>

        <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
