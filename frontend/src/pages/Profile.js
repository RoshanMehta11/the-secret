import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../utils/api';
import toast from 'react-hot-toast';
import './Profile.css';

const Profile = () => {
  const { user, login } = useAuth();
  const [username, setUsername] = useState(user?.username || '');
  const [saving, setSaving] = useState(false);

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
    </div>
  );
};

export default Profile;
