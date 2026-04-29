import React, { useState, useEffect, useCallback } from 'react';
import { adminAPI } from '../../utils/api';
import { toast } from 'react-toastify';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [banModal, setBanModal] = useState(null);
  const [banReason, setBanReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminAPI.getUsers({ page, search, filter });
      setUsers(data.users);
      setTotalPages(data.pages);
    } catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  }, [page, search, filter]);

  useEffect(() => { load(); }, [load]);

  const handleBan = async () => {
    try {
      const { data } = await adminAPI.banUser(banModal._id, {
        reason: banModal.isBanned ? '' : banReason,
      });
      setUsers((prev) => prev.map((u) => u._id === banModal._id ? { ...u, isBanned: data.isBanned, banReason: banModal.isBanned ? '' : banReason } : u));
      toast.success(data.message);
      setBanModal(null); setBanReason('');
    } catch { toast.error('Action failed'); }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await adminAPI.changeRole(userId, { role: newRole });
      setUsers((prev) => prev.map((u) => u._id === userId ? { ...u, role: newRole } : u));
      toast.success('Role updated');
    } catch { toast.error('Failed to update role'); }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="form-input" placeholder="Search users..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ maxWidth: 250 }} />
        <select className="form-input" value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }} style={{ maxWidth: 150 }}>
          <option value="">All Users</option>
          <option value="active">Active</option>
          <option value="banned">Banned</option>
        </select>
      </div>

      {loading ? <div className="spinner"><div className="spin" /></div> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>User</th><th>Email</th><th>Role</th><th>Posts</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{u.username || '—'}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(u.createdAt).toLocaleDateString()}</div>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{u.email}</td>
                  <td>
                    <select
                      className="form-input"
                      value={u.role}
                      onChange={(e) => handleRoleChange(u._id, e.target.value)}
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                      disabled={u.role === 'admin'}
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td>{u.postCount}</td>
                  <td>
                    <span className={`badge ${u.isBanned ? 'badge-red' : 'badge-green'}`}>
                      {u.isBanned ? '🚫 Banned' : '✅ Active'}
                    </span>
                  </td>
                  <td>
                    {u.role !== 'admin' && (
                      <button
                        className={`btn btn-sm ${u.isBanned ? 'btn-success' : 'btn-danger'}`}
                        onClick={() => setBanModal(u)}
                      >
                        {u.isBanned ? 'Unban' : 'Ban'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button key={p} className={`page-btn ${page === p ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
          ))}
        </div>
      )}

      {banModal && (
        <div className="modal-overlay" onClick={() => setBanModal(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">{banModal.isBanned ? 'Unban' : 'Ban'} User: {banModal.username || banModal.email}</h3>
            {!banModal.isBanned && (
              <div className="form-group">
                <label className="form-label">Ban Reason</label>
                <input className="form-input" placeholder="Reason for ban..." value={banReason} onChange={(e) => setBanReason(e.target.value)} />
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className={`btn ${banModal.isBanned ? 'btn-success' : 'btn-danger'}`} onClick={handleBan}>
                Confirm {banModal.isBanned ? 'Unban' : 'Ban'}
              </button>
              <button className="btn btn-ghost" onClick={() => setBanModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
