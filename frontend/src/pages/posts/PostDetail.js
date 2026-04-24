import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { postsAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import './PostDetail.css';

const PostDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [commenting, setCommenting] = useState(false);
  const [anonymousComment, setAnonymousComment] = useState(true);
  const [reporting, setReporting] = useState(false);
  const [reportReason, setReportReason] = useState('spam');

  useEffect(() => {
    postsAPI
      .getOne(id)
      .then((res) => setPost(res.data.post))
      .catch(() => toast.error('Post not found'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setCommenting(true);
    try {
      const res = await postsAPI.addComment(id, { content: comment, isAnonymous: anonymousComment });
      setPost((prev) => ({ ...prev, comments: [...(prev.comments || []), res.data.comment] }));
      setComment('');
      toast.success('Comment added!');
    } catch {
      toast.error('Failed to comment');
    } finally {
      setCommenting(false);
    }
  };

  const handleReport = async (e) => {
    e.preventDefault();
    if (!user) { toast.error('Login to report'); return; }
    try {
      await postsAPI.report(id, { reason: reportReason });
      toast.success('Reported. We will review it.');
      setReporting(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to report');
    }
  };

  if (loading) return <div className="flex-center" style={{ height: '60vh' }}><div className="spinner" /></div>;
  if (!post) return <div className="container" style={{ padding: '40px 16px', textAlign: 'center' }}>Post not found</div>;

  const timeAgo = (date) => {
    const diff = (Date.now() - new Date(date)) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="post-detail-page">
      <div className="container">
        <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>

        <div className="card post-full">
          <div className="post-full-header">
            <div>
              <span className="post-category-badge">{post.category}</span>
              <span className="post-time-badge">{timeAgo(post.createdAt)}</span>
            </div>
            <div className="post-full-author">
              {post.isAnonymous ? '🕵️ Anonymous' : `@${post.author?.username || 'deleted'}`}
            </div>
          </div>

          <p className="post-full-content">{post.content}</p>

          {post.mediaType !== 'none' && post.mediaUrl && (
            <div className="post-media-full">
              {post.mediaType === 'image' && <img src={post.mediaUrl} alt="Post media" />}
              {post.mediaType === 'audio' && <audio controls src={post.mediaUrl} style={{ width: '100%' }} />}
              {post.mediaType === 'video' && <video controls src={post.mediaUrl} style={{ width: '100%' }} />}
            </div>
          )}

          <div className="post-full-footer">
            <span>❤️ {post.likes?.length || 0} likes</span>
            <span>💬 {post.comments?.length || 0} comments</span>
            <span>👁 {post.views || 0} views</span>
            <button className="report-toggle" onClick={() => setReporting(!reporting)}>
              🚩 Report
            </button>
          </div>

          {reporting && (
            <form onSubmit={handleReport} className="report-form">
              <select
                className="form-control"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
              >
                {['spam', 'harassment', 'hate-speech', 'violence', 'misinformation', 'explicit-content', 'other'].map((r) => (
                  <option key={r} value={r}>{r.replace('-', ' ')}</option>
                ))}
              </select>
              <button type="submit" className="btn btn-danger btn-sm">Submit Report</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReporting(false)}>Cancel</button>
            </form>
          )}
        </div>

        {/* Comments */}
        <div className="comments-section">
          <h3 className="comments-title">💬 Comments ({post.comments?.length || 0})</h3>

          <form onSubmit={handleComment} className="comment-form">
            <textarea
              className="form-control"
              placeholder="Add a comment..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              maxLength={500}
            />
            <div className="comment-actions">
              {user && (
                <label className="anonymous-toggle">
                  <input
                    type="checkbox"
                    checked={anonymousComment}
                    onChange={(e) => setAnonymousComment(e.target.checked)}
                  />
                  <span>Anonymous comment</span>
                </label>
              )}
              <button type="submit" className="btn btn-primary btn-sm" disabled={commenting || !comment.trim()}>
                {commenting ? 'Posting...' : 'Post Comment'}
              </button>
            </div>
          </form>

          <div className="comments-list">
            {post.comments?.length === 0 ? (
              <p className="text-muted" style={{ textAlign: 'center', padding: '20px 0' }}>
                No comments yet. Be the first!
              </p>
            ) : (
              post.comments.map((c) => (
                <div key={c._id} className="comment-item">
                  <div className="comment-author">
                    {c.isAnonymous ? '🕵️ Anonymous' : `@${c.author?.username || 'deleted'}`}
                    <span className="comment-time">{timeAgo(c.createdAt)}</span>
                  </div>
                  <p className="comment-content">{c.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostDetail;
