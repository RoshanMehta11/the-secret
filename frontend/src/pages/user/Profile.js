import React, { useState, useEffect } from 'react';
import { usersAPI } from '../../utils/api';
import PostCard from '../../components/common/PostCard';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';

export default function Profile() {
  const { user, loadUser } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [profile, setProfile] = useState({ username: '', bio: '' });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [myPosts, setMyPosts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) setProfile({ username: user.username || '', bio: user.bio || '' });
    if (activeTab === 'posts') loadMyPosts();
  }, [user, activeTab]);

  const loadMyPosts = async () => {
    setLoading(true);
    try {
      const { data } = await usersAPI.getMyPosts();
      setMyPosts(data.posts);
    } catch {} finally { setLoading(false); }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    try {
      await usersAPI.updateProfile(profile);
      await loadUser();
      toast.success('Profile updated!');
    } catch (err) { toast.error(err.response?.data?.message || 'Update failed'); }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) { toast.error('Passwords do not match'); return; }
    try {
      await usersAPI.changePassword({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword });
      toast.success('Password changed!');
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const tabs = [{ id: 'profile', label: '👤 Profile' }, { id: 'posts', label: '📝 My Posts' }, { id: 'security', label: '🔐 Security' }];

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 700 }}>
        <div className="page-header">
          <h1 className="page-title">My Account</h1>
          <p className="page-subtitle">{user?.email}</p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
          {tabs.map((t) => (
            <button key={t.id} className={`btn btn-sm ${activeTab === t.id ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'profile' && (
          <div className="card">
            <h2 style={{ fontWeight: 700, marginBottom: '1rem' }}>Edit Profile</h2>
            <form onSubmit={saveProfile}>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input className="form-input" value={profile.username} onChange={(e) => setProfile((p) => ({ ...p, username: e.target.value }))} minLength={3} maxLength={30} />
              </div>
              <div className="form-group">
                <label className="form-label">Bio</label>
                <textarea className="form-input form-textarea" value={profile.bio} onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))} maxLength={160} rows={3} placeholder="Tell us about yourself (optional)" />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{profile.bio.length}/160</span>
              </div>
              <button type="submit" className="btn btn-primary">Save Changes</button>
            </form>
          </div>
        )}

        {activeTab === 'posts' && (
          <div>
            {loading ? <div className="spinner"><div className="spin" /></div> :
              myPosts.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No posts yet. Share your first secret!
                </div>
              ) : myPosts.map((p) => <PostCard key={p._id} post={p} onDelete={(id) => setMyPosts((prev) => prev.filter((x) => x._id !== id))} />)
            }
          </div>
        )}

        {activeTab === 'security' && (
          <div className="card">
            <h2 style={{ fontWeight: 700, marginBottom: '1rem' }}>Change Password</h2>
            <form onSubmit={changePassword}>
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input className="form-input" type="password" value={passwords.currentPassword} onChange={(e) => setPasswords((p) => ({ ...p, currentPassword: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input className="form-input" type="password" value={passwords.newPassword} onChange={(e) => setPasswords((p) => ({ ...p, newPassword: e.target.value }))} minLength={6} required />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input className="form-input" type="password" value={passwords.confirmPassword} onChange={(e) => setPasswords((p) => ({ ...p, confirmPassword: e.target.value }))} required />
              </div>
              <button type="submit" className="btn btn-primary">Update Password</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
