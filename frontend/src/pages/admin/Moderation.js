import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../utils/api';
import { toast } from 'react-toastify';

export default function Moderation() {
  const [queue, setQueue] = useState([]);
  const [modStats, setModStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [blocklist, setBlocklist] = useState([]);
  const [newWord, setNewWord] = useState('');
  const [tab, setTab] = useState('queue'); // queue, stats, blocklist

  useEffect(() => {
    loadQueue();
    loadStats();
  }, []);

  const loadQueue = () => {
    adminAPI.getModerationQueue()
      .then(({ data }) => setQueue(data.posts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const loadStats = () => {
    adminAPI.getModerationStats()
      .then(({ data }) => setModStats(data.stats))
      .catch(() => {});
  };

  const handleReview = async (postId, decision) => {
    try {
      await adminAPI.reviewModeration(postId, { decision });
      setQueue((prev) => prev.filter((p) => p._id !== postId));
      toast.success(`Post ${decision}!`);
      loadStats();
    } catch { toast.error('Review failed'); }
  };

  const handleAddWord = async () => {
    if (!newWord.trim()) return;
    try {
      const { data } = await adminAPI.updateBlocklist({ add: [newWord.trim().toLowerCase()] });
      setBlocklist(data.blocklist || []);
      setNewWord('');
      toast.success('Word added to blocklist');
    } catch { toast.error('Failed to add word'); }
  };

  const handleRemoveWord = async (word) => {
    try {
      const { data } = await adminAPI.updateBlocklist({ remove: [word] });
      setBlocklist(data.blocklist || []);
    } catch { toast.error('Failed'); }
  };

  const ScoreBar = ({ label, score }) => {
    const pct = Math.round((score || 0) * 100);
    const color = pct > 70 ? 'var(--danger)' : pct > 40 ? 'var(--warning)' : 'var(--success)';
    return (
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 2 }}>
          <span style={{ color: 'var(--text-muted)' }}>{label}</span>
          <span style={{ color, fontWeight: 700 }}>{pct}%</span>
        </div>
        <div style={{ height: 6, background: 'var(--bg-secondary)', borderRadius: 3 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.3s' }} />
        </div>
      </div>
    );
  };

  return (
    <div>
      <h2 style={{ fontWeight: 700, marginBottom: 'var(--gap)' }}>🤖 AI Moderation</h2>

      {/* Tabs */}
      <div className="feed-tabs" style={{ marginBottom: 'var(--gap-lg)' }}>
        <button className={`feed-tab ${tab === 'queue' ? 'active' : ''}`} onClick={() => setTab('queue')}>
          📋 Queue ({queue.length})
        </button>
        <button className={`feed-tab ${tab === 'stats' ? 'active' : ''}`} onClick={() => setTab('stats')}>
          📊 Stats
        </button>
        <button className={`feed-tab ${tab === 'blocklist' ? 'active' : ''}`} onClick={() => setTab('blocklist')}>
          🚫 Blocklist
        </button>
      </div>

      {tab === 'queue' && (
        loading ? (
          <div className="spinner"><div className="spin" /></div>
        ) : queue.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>✅</div>
            <p style={{ fontSize: '1rem' }}>Moderation queue is clear!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
            {queue.map((post) => (
              <div key={post._id} className="card" style={{ borderLeft: '4px solid var(--warning)' }}>
                {/* Content */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                    By: {post.author?.username || 'Anonymous'} · {new Date(post.createdAt).toLocaleString()}
                  </div>
                  <p style={{ fontSize: '0.9rem', lineHeight: 1.7, background: 'var(--bg-secondary)', padding: 12, borderRadius: 8 }}>
                    {post.content}
                  </p>
                </div>

                {/* Toxicity Scores */}
                {post.moderationScores && (
                  <div style={{ marginBottom: 16 }}>
                    <ScoreBar label="Toxicity" score={post.moderationScores.toxicity} />
                    <ScoreBar label="Spam" score={post.moderationScores.spam} />
                    <ScoreBar label="Threat" score={post.moderationScores.threat} />
                    <ScoreBar label="Identity Attack" score={post.moderationScores.identity_attack} />
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Model: {post.moderatedBy || 'pending'} · Status: <span className="badge badge-yellow">{post.moderationStatus}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-success btn-sm" onClick={() => handleReview(post._id, 'approved')}>
                      ✅ Approve
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleReview(post._id, 'rejected')}>
                      ❌ Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'stats' && modStats && (
        <div className="grid-4">
          <div className="card stat-card">
            <div className="stat-value" style={{ color: 'var(--success)' }}>{modStats.approved}</div>
            <div className="stat-label">Approved</div>
          </div>
          <div className="card stat-card">
            <div className="stat-value" style={{ color: 'var(--warning)' }}>{modStats.flagged}</div>
            <div className="stat-label">Flagged</div>
          </div>
          <div className="card stat-card">
            <div className="stat-value" style={{ color: 'var(--danger)' }}>{modStats.rejected}</div>
            <div className="stat-label">Rejected</div>
          </div>
          <div className="card stat-card">
            <div className="stat-value" style={{ color: 'var(--purple)' }}>{modStats.totalAudited}</div>
            <div className="stat-label">Total Audited</div>
          </div>
        </div>
      )}

      {tab === 'blocklist' && (
        <div className="card">
          <h3 style={{ fontWeight: 700, marginBottom: 12 }}>🚫 Word Blocklist</h3>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              className="form-input"
              placeholder="Add word to blocklist..."
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary btn-sm" onClick={handleAddWord}>Add</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {blocklist.map((word) => (
              <span key={word} className="badge badge-red" style={{ cursor: 'pointer', padding: '4px 10px' }} onClick={() => handleRemoveWord(word)}>
                {word} ✕
              </span>
            ))}
            {blocklist.length === 0 && <p className="text-muted">No words in blocklist</p>}
          </div>
        </div>
      )}
    </div>
  );
}
