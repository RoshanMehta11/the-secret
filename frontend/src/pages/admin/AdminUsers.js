import React, { useEffect, useState } from 'react';
import { adminAPI } from '../../utils/api';
import toast from 'react-hot-toast';
import './Admin.css';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [banModal, setBanModal] = useState(null); // { userId, username }
  const [banReason, setBanReason] = useState('');

  const fetchUsers = async (p = 1, s = search) => {
    setLoading(true);
    try {
      const res = await adminAPI.getUsers({ page: p, limit: 20, search: s });
      setUsers(res.data.users);
      setPagination(res.data.pagination);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchUsers(1, search);
  };

  const handleBan = async (userId, isBanned) => {
    if (!isBanned && !banReason.trim()) {
      toast.error('Provide a ban reason');
      return;
    }
    try {
      await adminAPI.banUser(userId, { isBanned, banReason });
      toast.success(isBanned ? 'User banned' : 'User unbanned');
      setBanModal(null);
      setBanReason('');
      fetchUsers(page);
    } catch {
      toast.error('Action failed');
    }
  };

  const handleDelete = async (userId, username) => {
    if (!window.confirm(`Delete user @${username}? This cannot be undone.`)) return;
    try {
      await adminAPI.deleteUser(userId);
      toast.success('User deleted');
      fetchUsers(page);
    } catch {
      toast.error('Delete failed');
    }
  };

  return (
    <div>
      <h2 className="page-title">Users Management</h2>

      <div className="admin-filters">
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="Search by username or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 280 }}
          />
          <button type="submit" className="btn btn-primary btn-sm">Search</button>
        </form>
        <span className="text-muted" style={{ alignSelf: 'center' }}>
          {pagination.total || 0} users total
        </span>
      </div>

      <div className="card admin-table-wrap">
        {loading ? (
          <div className="flex-center" style={{ padding: '40px' }}><div className="spinner" /></div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Provider</th>
                <th>Posts</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id}>
                  <td><strong>@{user.username}</strong></td>
                  <td className="text-muted">{user.email}</td>
                  <td>
                    <span className="badge badge-primary">{user.authProvider}</span>
                  </td>
                  <td>{user.postsCount}</td>
                  <td>
                    {user.isBanned ? (
                      <span className="badge badge-danger">Banned</span>
                    ) : (
                      <span className="badge badge-success">Active</span>
                    )}
                  </td>
                  <td className="text-muted">{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="table-actions">
                      {user.isBanned ? (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleBan(user._id, false)}
                        >
                          Unban
                        </button>
                      ) : (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => setBanModal({ userId: user._id, username: user.username })}
                        >
                          Ban
                        </button>
                      )}
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(user._id, user.username)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {pagination.pages > 1 && (
        <div className="page-nav">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setPage(page - 1); fetchUsers(page - 1); }}
            disabled={page === 1}
          >
            ← Prev
          </button>
          <span>Page {page} of {pagination.pages}</span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setPage(page + 1); fetchUsers(page + 1); }}
            disabled={page >= pagination.pages}
          >
            Next →
          </button>
        </div>
      )}

      {/* Ban Modal */}
      {banModal && (
        <div className="modal-overlay" onClick={() => setBanModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Ban @{banModal.username}</h3>
            <div className="form-group" style={{ marginTop: 16 }}>
              <label className="form-label">Ban Reason</label>
              <input
                type="text"
                className="form-control"
                placeholder="Enter reason for ban..."
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                className="btn btn-danger"
                onClick={() => handleBan(banModal.userId, true)}
              >
                Confirm Ban
              </button>
              <button className="btn btn-ghost" onClick={() => setBanModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
