import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { postsAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import './PostCard.css';

const CATEGORY_COLORS = {
  general: '#6366f1',
  confession: '#ec4899',
  advice: '#10b981',
  rant: '#f59e0b',
  happy: '#06b6d4',
  'mental-health': '#8b5cf6',
};

const PostCard = ({ post, onDelete }) => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [likes, setLikes] = useState(post.likes?.length || 0);
  const [liked, setLiked] = useState(user ? post.likes?.includes(user._id) : false);
  const [liking, setLiking] = useState(false);

  const timeAgo = (date) => {
    const diff = (Date.now() - new Date(date)) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const handleLike = async (e) => {
    e.preventDefault();
    if (!user) { toast.error('Login to like posts'); return; }
    if (liking) return;
    setLiking(true);
    try {
      const res = await postsAPI.like(post._id);
      setLiked(res.data.liked);
      setLikes(res.data.likesCount);
    } catch {
      toast.error('Failed to like');
    } finally {
      setLiking(false);
    }
  };

  const handleDelete = async (e) => {
    e.preventDefault();
    if (!window.confirm('Delete this post?')) return;
    try {
      await postsAPI.delete(post._id);
      toast.success('Post deleted');
      onDelete?.(post._id);
    } catch {
      toast.error('Failed to delete');
    }
  };

  const canDelete = isAdmin || (user && post.author?._id === user._id && !post.isAnonymous);

  return (
    <div className="post-card">
      <div className="post-header">
        <div className="post-meta">
          <span
            className="post-category"
            style={{ background: CATEGORY_COLORS[post.category] + '22', color: CATEGORY_COLORS[post.category] }}
          >
            {post.category}
          </span>
          <span className="post-time">{timeAgo(post.createdAt)}</span>
        </div>
        <div className="post-author">
          {post.isAnonymous ? (
            <span className="anonymous-tag">🕵️ Anonymous</span>
          ) : (
            <span className="author-name">@{post.author?.username || 'deleted'}</span>
          )}
        </div>
      </div>

      <Link to={`/posts/${post._id}`} className="post-content-link">
        <p className="post-content">{post.content}</p>

        {post.mediaType !== 'none' && post.mediaUrl && (
          <div className="post-media">
            {post.mediaType === 'image' && (
              <img src={post.mediaUrl} alt="Post media" className="media-img" />
            )}
            {post.mediaType === 'audio' && (
              <audio controls src={post.mediaUrl} className="media-audio" />
            )}
            {post.mediaType === 'video' && (
              <video controls src={post.mediaUrl} className="media-video" />
            )}
          </div>
        )}
      </Link>

      <div className="post-footer">
        <div className="post-actions">
          <button className={`action-btn ${liked ? 'liked' : ''}`} onClick={handleLike}>
            {liked ? '❤️' : '🤍'} {likes}
          </button>
          <Link to={`/posts/${post._id}`} className="action-btn">
            💬 {post.comments?.length || 0}
          </Link>
          <span className="action-btn passive">👁 {post.views || 0}</span>
        </div>

        {canDelete && (
          <button className="action-btn danger" onClick={handleDelete}>
            🗑️ Delete
          </button>
        )}
      </div>
    </div>
  );
};

export default PostCard;
