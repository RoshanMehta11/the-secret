import React, { useState, useEffect, useCallback } from 'react';
import { adminAPI } from '../../utils/api';
import { toast } from 'react-toastify';

const statusColors = { pending: 'badge-yellow', reviewed: 'badge-purple', action_taken: 'badge-red', dismissed: 'badge-gray' };

export default function AdminReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminAPI.getReports({ status, page });
      setReports(data.reports);
      setTotalPages(data.pages);
    } catch { toast.error('Failed to load reports'); }
    finally { setLoading(false); }
  }, [status, page]);

  useEffect(() => { load(); }, [load]);

  const updateReport = async (newStatus) => {
    try {
      await adminAPI.updateReport(selected._id, { status: newStatus, adminNote: note });
      setReports((prev) => prev.filter((r) => r._id !== selected._id));
      setSelected(null); setNote('');
      toast.success('Report updated');
    } catch { toast.error('Update failed'); }
  };

  const reasonLabels = {
    spam: 'Spam', harassment: 'Harassment', hate_speech: 'Hate Speech',
    misinformation: 'Misinformation', explicit_content: 'Explicit Content', other: 'Other'
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {['pending', 'reviewed', 'action_taken', 'dismissed'].map((s) => (
          <button key={s} className={`btn btn-sm ${status === s ? 'btn-primary' : 'btn-ghost'}`} onClick={() => { setStatus(s); setPage(1); }}>
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {loading ? <div className="spinner"><div className="spin" /></div> : (
        <div>
          {reports.map((r) => (
            <div key={r._id} className="card" style={{ marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <span className={`badge ${statusColors[r.status]}`}>{r.status.replace('_', ' ')}</span>
                    <span className="badge badge-purple">{reasonLabels[r.reason] || r.reason}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.targetType}</span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    By: {r.reporter?.username || 'Anonymous'} · {new Date(r.createdAt).toLocaleString()}
                  </p>
                  {r.description && <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>{r.description}</p>}
                  {r.adminNote && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Note: {r.adminNote}</p>}
                </div>
                {r.status === 'pending' && (
                  <button className="btn btn-primary btn-sm" onClick={() => { setSelected(r); setNote(''); }}>Review</button>
                )}
              </div>
            </div>
          ))}
          {reports.length === 0 && <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No reports found</div>}
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button key={p} className={`page-btn ${page === p ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
          ))}
        </div>
      )}

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Review Report</h3>
            <div style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              <p>Reason: {reasonLabels[selected.reason]}</p>
              {selected.description && <p>Description: {selected.description}</p>}
            </div>
            <div className="form-group">
              <label className="form-label">Admin Note (optional)</label>
              <input className="form-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Internal note..." />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button className="btn btn-danger btn-sm" onClick={() => updateReport('action_taken')}>Take Action</button>
              <button className="btn btn-ghost btn-sm" onClick={() => updateReport('dismissed')}>Dismiss</button>
              <button className="btn btn-secondary btn-sm" onClick={() => updateReport('reviewed')}>Mark Reviewed</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
