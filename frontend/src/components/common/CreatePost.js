import React, { useState } from 'react';
import { postsAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { MOODS, detectMood } from '../../utils/moodEngine';
import { toast } from 'react-toastify';

export default function CreatePost({ onPostCreated }) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [mood, setMood] = useState('random');
  const [loading, setLoading] = useState(false);

  const handleContentChange = (e) => {
    const text = e.target.value;
    setContent(text);
    // Auto-detect mood as user types (debounced feel since it's on change)
    if (text.length > 20) {
      const detected = detectMood(text);
      if (detected !== 'random') setMood(detected);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) { toast.warn('Write something first!'); return; }
    if (content.length > 2000) { toast.warn('Post too long (max 2000 chars)'); return; }
    setLoading(true);
    try {
      const { data } = await postsAPI.create({ content, tags, isAnonymous, mood });
      setContent('');
      setTags('');
      setMood('random');
      toast.success('Secret shared! 🔒');
      if (onPostCreated) onPostCreated(data.post);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to post');
    } finally {
      setLoading(false);
    }
  };

  const activeMood = MOODS[mood];

  return (
    <div className="card create-post" style={{ borderLeft: `4px solid ${activeMood.border}` }}>
      <div className="create-post-header">
        <span style={{ fontSize: '1.1rem' }}>🔒</span>
        <h3>Share Your Secret</h3>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Mood Selector */}
        <div className="mood-selector">
          {Object.entries(MOODS).map(([key, m]) => (
            <button
              key={key}
              type="button"
              className={`mood-option ${mood === key ? 'active' : ''}`}
              onClick={() => setMood(key)}
              style={
                mood === key
                  ? { '--mood-border': m.border, '--mood-bg': m.bg, '--mood-accent': m.accent }
                  : {}
              }
            >
              {m.emoji} {m.label}
            </button>
          ))}
        </div>

        <textarea
          className="form-input form-textarea"
          placeholder="What's on your mind? Share anonymously..."
          value={content}
          onChange={handleContentChange}
          maxLength={2000}
          rows={4}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0 12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span>Text only · Max 2000 characters</span>
          <span className="char-count">{content.length}/2000</span>
        </div>

        <div className="form-group" style={{ marginBottom: 12 }}>
          <input
            className="form-input"
            placeholder="Tags (comma-separated, e.g. life, thoughts, mental-health)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </div>

        <div className="create-post-footer">
          {user && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} />
              Post anonymously
            </label>
          )}
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginLeft: 'auto' }}>
            {loading ? 'Sharing...' : `${activeMood.emoji} Share Secret`}
          </button>
        </div>
      </form>
    </div>
  );
}
