import React, { useEffect, useState } from 'react';
import { adminAPI } from '../../utils/api';
import toast from 'react-hot-toast';
import './Admin.css';

const AdminReports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});

  const fetchReports = async (p = 1, s = status) => {
    setLoading(true);
    try {
      const res = await adminAPI.getReports({ page: p, limit: 20, status: s });
      setReports(res.data.reports);
      setPagination(res.data.pagination);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
    // eslint-disable-next-line
  }, []);

  const handleStatusChange = (newStatus) => {
    setStatus(newStatus);
    setPage(1);
    fetchReports(1, newStatus);
  };

  const handleResolve = async (reportId, newStatus, adminNote = '') => {
    try {
      await adminAPI.resolveReport(reportId, { status: newStatus, adminNote });
      toast.success(`Report ${newStatus}`);
      fetchReports(page);
    } catch {
      toast.error('Action failed');
    }
  };

  const statusBadge = (s) => {
    const map = { pending: 'warning', reviewed: 'primary', resolved: 'success', dismissed: 'danger' };
    return <span className={`badge badge-${map[s] || 'primary'}`}>{s}</span>;
  };

  return (
    <div>
      <h2 className="page-title">Reports Management</h2>

      <div className="admin-filters">
        {['pending', 'reviewed', 'resolved', 'dismissed'].map((s) => (
          <button
            key={s}
            className={`btn btn-sm ${status === s ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => handleStatusChange(s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <span className="text-muted" style={{ alignSelf: 'center' }}>
          {pagination.total || 0} reports
        </span>
      </div>

      <div className="card admin-table-wrap">
        {loading ? (
          <div className="flex-center" style={{ padding: '40px' }}><div className="spinner" /></div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Post Content</th>
                <th>Reason</th>
                <th>Reported By</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report._id}>
                  <td style={{ maxWidth: 180 }}>
                    <p style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                      {report.post?.content || '[Post deleted]'}
                    </p>
                  </td>
                  <td>
                    <span className="badge badge-warning">{report.reason}</span>
                  </td>
                  <td className="text-muted">
                    {report.reportedBy ? `@${report.reportedBy.username}` : 'Guest'}
                  </td>
                  <td>{statusBadge(report.status)}</td>
                  <td className="text-muted">{new Date(report.createdAt).toLocaleDateString()}</td>
                  <td>
                    {report.status === 'pending' && (
                      <div className="table-actions">
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleResolve(report._id, 'reviewed')}
                        >
                          Review
                        </button>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleResolve(report._id, 'resolved', 'Content removed')}
                        >
                          Resolve
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleResolve(report._id, 'dismissed', 'Not a violation')}
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                    {report.status !== 'pending' && (
                      <span className="text-muted" style={{ fontSize: 12 }}>
                        {report.adminNote || 'No note'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {reports.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                    No {status} reports
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {pagination.pages > 1 && (
        <div className="page-nav">
          <button className="btn btn-ghost btn-sm" onClick={() => { setPage(page - 1); fetchReports(page - 1); }} disabled={page === 1}>← Prev</button>
          <span>Page {page} of {pagination.pages}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => { setPage(page + 1); fetchReports(page + 1); }} disabled={page >= pagination.pages}>Next →</button>
        </div>
      )}
    </div>
  );
};

export default AdminReports;
