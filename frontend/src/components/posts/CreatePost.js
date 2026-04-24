import React, { useState } from 'react';
import { postsAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import './CreatePost.css';

const CATEGORIES = ['general', 'confession', 'advice', 'rant', 'happy', 'mental-health'];

const CreatePost = ({ onPostCreated }) => {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('general');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [mediaType, setMediaType] = useState('none');
  const [mediaUrl, setMediaUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) { toast.error('Write something first!'); return; }
    if (content.length > 2000) { toast.error('Max 2000 characters'); return; }

    setLoading(true);
    try {
      const res = await postsAPI.create({
        content: content.trim(),
        category,
        isAnonymous: user ? isAnonymous : true,
        mediaType: mediaUrl ? mediaType : 'none',
        mediaUrl: mediaUrl || '',
      });

      toast.success('Secret shared! 🔒');
      setContent('');
      setCategory('general');
      setMediaType('none');
      setMediaUrl('');
      setExpanded(false);
      onPostCreated?.(res.data.post);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to post');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-post">
      <h3 className="create-title">🔒 Share Your Secret</h3>

      <form onSubmit={handleSubmit}>
        <textarea
          className="form-control post-textarea"
          placeholder="What's on your mind? Share anonymously..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onFocus={() => setExpanded(true)}
          rows={expanded ? 4 : 2}
          maxLength={2000}
        />

        <div className="char-count">{content.length}/2000</div>

        {expanded && (
          <div className="post-options">
            <div className="options-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Category</label>
                <select
                  className="form-control"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Media Type</label>
                <select
                  className="form-control"
                  value={mediaType}
                  onChange={(e) => { setMediaType(e.target.value); setMediaUrl(''); }}
                >
                  <option value="none">No Media</option>
                  <option value="image">Image URL</option>
                  <option value="audio">Audio URL</option>
                  <option value="video">Video URL</option>
                </select>
              </div>
            </div>

            {mediaType !== 'none' && (
              <div className="form-group">
                <label className="form-label">{mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} URL</label>
                <input
                  type="url"
                  className="form-control"
                  placeholder={`Enter ${mediaType} URL (e.g. https://...)`}
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                />
              </div>
            )}

            {user && (
              <label className="anonymous-toggle">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                />
                <span>Post Anonymously (hide my identity)</span>
              </label>
            )}
          </div>
        )}

        <div className="post-submit-row">
          {!user && (
            <span className="text-muted">
              🕵️ You're posting as anonymous guest
            </span>
          )}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !content.trim()}
            style={{ marginLeft: 'auto' }}
          >
            {loading ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : '🔐 Post Secretly'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreatePost;
