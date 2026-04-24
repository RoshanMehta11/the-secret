import React, { useState, useEffect, useCallback } from 'react';
import { adminAPI } from '../../utils/api';
import { toast } from 'react-toastify';

export default function AdminPosts() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminAPI.getPosts({ page, filter });
      setPosts(data.posts);
      setTotalPages(data.pages);
    } catch { toast.error('Failed to load posts'); }
    finally { setLoading(false); }
  }, [page, filter]);

  useEffect(() => { load(); }, [load]);

  const toggleHide = async (id) => {
    try {
      const { data } = await adminAPI.hidePost(id);
      setPosts((prev) => prev.map((p) => p._id === id ? { ...p, isHidden: data.isHidden } : p));
    } catch { toast.error('Action failed'); }
  };

  const deletePost = async (id) => {
    if (!window.confirm('Delete this post permanently?')) return;
    try {
      await adminAPI.deletePost(id);
      setPosts((prev) => prev.filter((p) => p._id !== id));
      toast.success('Post deleted');
    } catch { toast.error('Delete failed'); }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {[['', 'All'], ['reported', '🚩 Reported'], ['hidden', '🙈 Hidden']].map(([val, label]) => (
          <button key={val} className={`btn btn-sm ${filter === val ? 'btn-primary' : 'btn-ghost'}`} onClick={() => { setFilter(val); setPage(1); }}>
            {label}
          </button>
        ))}
      </div>

      {loading ? <div className="spinner"><div className="spin" /></div> : (
        <div>
          {posts.map((p) => (
            <div key={p._id} className="card" style={{ marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span>👤 {p.isAnonymous ? 'Anonymous' : (p.author?.username || 'Unknown')}</span>
                    <span>·</span>
                    <span>{new Date(p.createdAt).toLocaleString()}</span>
                    {p.isHidden && <span className="badge badge-yellow">Hidden</span>}
                    {p.isReported && <span className="badge badge-red">🚩 {p.reportCount} reports</span>}
                  </div>
                  <p style={{ fontSize: '0.9rem', lineHeight: 1.5, wordBreak: 'break-word' }}>{p.content.substring(0, 200)}{p.content.length > 200 ? '...' : ''}</p>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                    ❤️ {p.likesCount} · 💬 {p.commentsCount}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                  <button className={`btn btn-sm ${p.isHidden ? 'btn-success' : 'btn-secondary'}`} onClick={() => toggleHide(p._id)}>
                    {p.isHidden ? '👁️ Show' : '🙈 Hide'}
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => deletePost(p._id)}>🗑️</button>
                </div>
              </div>
            </div>
          ))}
          {posts.length === 0 && <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No posts found</div>}
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button key={p} className={`page-btn ${page === p ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
          ))}
        </div>
      )}
    </div>
  );
}
