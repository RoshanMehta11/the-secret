import React, { useState, useMemo } from 'react';
import { postsAPI, chatAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useChatContext } from '../../context/ChatContext';
import { getMoodTheme } from '../../utils/moodEngine';
import AnonAvatar from './AnonAvatar';
import { toast } from 'react-toastify';

export default function PostCard({ post, onDelete }) {
  const { user } = useAuth();
  const { openChat } = useChatContext();
  const [liked, setLiked] = useState(post.isLiked);
  const [likesCount, setLikesCount] = useState(post.likesCount || 0);
  const [likeAnim, setLikeAnim] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [startingChat, setStartingChat] = useState(false);

  const mood = post.mood || 'random';
  const moodTheme = useMemo(() => getMoodTheme(mood), [mood]);

  const toggleLike = async () => {
    if (!user) { toast.info('Login to like posts'); return; }
    // Optimistic update
    setLiked((prev) => !prev);
    setLikesCount((prev) => liked ? prev - 1 : prev + 1);
    setLikeAnim(true);
    setTimeout(() => setLikeAnim(false), 300);
    try {
      const { data } = await postsAPI.like(post._id);
      setLiked(data.liked);
      setLikesCount(data.likesCount);
    } catch {
      // Rollback
      setLiked((prev) => !prev);
      setLikesCount((prev) => liked ? prev + 1 : prev - 1);
    }
  };

  const loadComments = async () => {
    if (showComments) { setShowComments(false); return; }
    setLoadingComments(true);
    try {
      const { data } = await postsAPI.getComments(post._id);
      setComments(data.comments);
      setShowComments(true);
    } catch { toast.error('Failed to load comments'); }
    finally { setLoadingComments(false); }
  };

  const submitComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      const { data } = await postsAPI.addComment(post._id, { content: commentText, isAnonymous: true });
      setComments((prev) => [data.comment, ...prev]);
      setCommentText('');
    } catch { toast.error('Failed to post comment'); }
  };

  const submitReport = async () => {
    if (!reportReason) { toast.warn('Select a reason'); return; }
    try {
      await postsAPI.report(post._id, { reason: reportReason });
      toast.success('Report submitted');
      setShowReport(false);
    } catch { toast.error('Report failed'); }
  };

  const timeAgo = (date) => {
    const diff = Date.now() - new Date(date);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const authorId = post.author?._id || post.author || post.ipHash || 'anon';
  const authorName = post.isAnonymous ? 'Anonymous' : (post.author?.username || 'User');
  const isTrending = (post.engagementVelocity || 0) > 2;
  const isFlagged = post.moderationStatus === 'flagged';

  const cardStyle = {
    '--mood-border': moodTheme.border,
    '--mood-bg': moodTheme.bg,
    '--mood-glow': moodTheme.glow,
    '--mood-accent': moodTheme.accent,
    '--glow-color': moodTheme.glow,
  };

  return (
    <div
      className={`card post-card anim-mood ${isTrending ? 'anim-pulse-glow' : ''}`}
      style={cardStyle}
    >
      {/* Header */}
      <div className="post-header">
        <div className="post-author">
          <AnonAvatar userId={authorId} size={36} />
          <div className="post-author-info">
            <span className="post-author-name">
              {authorName}
              <span className="post-mood-tag" style={{ background: moodTheme.bg, color: moodTheme.accent, borderColor: moodTheme.border }}>
                {moodTheme.emoji} {moodTheme.label}
              </span>
            </span>
            <span className="post-time">{timeAgo(post.createdAt)}</span>
          </div>
        </div>
        <div className="post-badges">
          {isTrending && <span className="badge badge-red">🔥 Trending</span>}
          {isFlagged && <span className="badge badge-yellow">⚠️ Flagged</span>}
          {post.feedScore > 5 && <span className="badge badge-purple">🧠 Smart Pick</span>}
        </div>
      </div>

      {/* Content */}
      <p className="post-content">{post.content}</p>

      {/* Tags */}
      {post.tags?.length > 0 && (
        <div className="post-tags">
          {post.tags.map((t) => <span key={t} className="tag">#{t}</span>)}
        </div>
      )}

      {/* Actions */}
      <div className="post-actions">
        <button
          className={`post-action-btn ${liked ? 'liked' : ''} ${likeAnim ? 'anim-like' : ''}`}
          onClick={toggleLike}
        >
          {liked ? '❤️' : '🤍'} <span className={likeAnim ? 'anim-count' : ''}>{likesCount}</span>
        </button>
        <button className="post-action-btn" onClick={loadComments} disabled={loadingComments}>
          💬 {post.commentsCount || 0}
        </button>
        <button className="post-action-btn" onClick={() => setShowReport(true)}>🚩</button>
        {user && (post.author?._id === user.id || user.role === 'admin') && (
          <button className="post-action-btn" onClick={() => onDelete?.(post._id)} style={{ color: 'var(--danger)' }}>
            🗑️
          </button>
        )}

        {/* Start Conversation — privacy-preserving anonymous messaging */}
        {user && post.author && (post.author?._id || post.author) !== user.id && (post.author?._id || post.author) !== user._id && (
          <button
            className="post-action-btn"
            onClick={async () => {
              if (startingChat) return;
              setStartingChat(true);
              try {
                const { data } = await chatAPI.startFromPost(post._id);
                openChat(data.conversation);
                if (data.isExisting) toast.info('Opening existing conversation');
                else toast.success('Anonymous conversation started! 🔒');
              } catch (err) {
                const msg = err.response?.data?.message || 'Cannot start conversation';
                toast.error(msg);
              } finally {
                setStartingChat(false);
              }
            }}
            disabled={startingChat}
            style={{ marginLeft: 'auto', color: 'var(--purple-light)' }}
            title="Start anonymous conversation with this post's author"
          >
            {startingChat ? '⏳' : '🔒'} {startingChat ? 'Connecting...' : 'Start Conversation'}
          </button>
        )}

        {/* Engagement velocity */}
        {(post.engagementVelocity || 0) > 0 && (
          <div className="post-activity">
            ⚡ {post.engagementVelocity.toFixed(1)} velocity
          </div>
        )}
      </div>

      {/* Comments */}
      {showComments && (
        <div className="comment-section">
          <form onSubmit={submitComment} className="comment-form">
            <input
              className="form-input"
              placeholder="Add anonymous comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              maxLength={500}
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn btn-primary btn-sm">Send</button>
          </form>
          {comments.map((c) => (
            <div key={c._id} className="comment-item">
              <span className="comment-author">
                🕵️ {c.isAnonymous ? 'Anonymous' : (c.author?.username || 'User')}:
              </span>
              {c.content}
            </div>
          ))}
          {comments.length === 0 && <p className="text-muted" style={{ padding: '8px 0' }}>No comments yet. Be the first!</p>}
        </div>
      )}

      {/* Report Modal */}
      {showReport && (
        <div className="modal-overlay" onClick={() => setShowReport(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>🚩 Report Post</h3>
            <p className="text-muted" style={{ marginBottom: 16 }}>Help us keep The Secret safe.</p>
            <div className="form-group">
              <label className="form-label">Reason</label>
              <select className="form-input" value={reportReason} onChange={(e) => setReportReason(e.target.value)}>
                <option value="">Select reason...</option>
                <option value="spam">Spam</option>
                <option value="harassment">Harassment</option>
                <option value="hate_speech">Hate Speech</option>
                <option value="misinformation">Misinformation</option>
                <option value="explicit_content">Explicit Content</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-danger" onClick={submitReport}>Submit Report</button>
              <button className="btn btn-ghost" onClick={() => setShowReport(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
