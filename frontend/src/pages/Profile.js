import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../utils/api';
import { toast } from 'react-toastify';
import ShareProfileModal from '../components/common/ShareProfileModal';
import './Profile.css';

const Profile = () => {
  const { user, login } = useAuth();
  const [username, setUsername] = useState(user?.username || '');
  const [saving, setSaving] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await authAPI.updateProfile({ username });
      const token = localStorage.getItem('token');
      login(token, res.data.user);
      toast.success('Profile updated!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const userId = user?.id || user?._id;

  return (
    <div className="profile-page">
      <div className="container">
        <h1 className="page-title">My Profile</h1>

        <div className="profile-grid">
          <div className="card profile-info">
            <div className="profile-avatar">
              {user?.avatar ? (
                <img src={user.avatar} alt="Avatar" />
              ) : (
                <div className="avatar-placeholder">{user?.username?.[0]?.toUpperCase() || '?'}</div>
              )}
            </div>
            <h2>{user?.username}</h2>
            <p className="text-muted">{user?.email}</p>
            <div className="profile-badges">
              <span className={`badge badge-${user?.role === 'admin' ? 'danger' : 'primary'}`}>
                {user?.role}
              </span>
              <span className="badge badge-success">
                {user?.authProvider} login
              </span>
            </div>
            <div className="profile-stat">
              📝 {user?.postsCount || 0} posts shared
            </div>
            <div className="profile-stat text-muted" style={{ fontSize: 12 }}>
              Joined {new Date(user?.createdAt).toLocaleDateString()}
            </div>

            {/* Share Profile Button */}
            <button
              onClick={() => setShowShareModal(true)}
              style={{
                marginTop: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', padding: '10px 16px',
                background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                color: 'white', border: 'none', borderRadius: 'var(--radius-md)',
                fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
                transition: 'all 200ms ease',
                boxShadow: '0 2px 12px rgba(124,58,237,0.3)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              📱 Share Profile
            </button>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: 20 }}>Edit Profile</h3>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  type="text"
                  className="form-control"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  minLength={3}
                  maxLength={30}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-control"
                  value={user?.email}
                  disabled
                  style={{ opacity: 0.5 }}
                />
                <small className="text-muted">Email cannot be changed</small>
              </div>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Share Profile Modal */}
      {showShareModal && userId && (
        <ShareProfileModal
          userId={userId}
          username={user?.username || 'User'}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
};

export default Profile;
