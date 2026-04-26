import React, { useState, useEffect, useCallback, useRef } from 'react';
import CreatePost from '../components/common/CreatePost';
import PostCard from '../components/common/PostCard';
import FeedTabs from '../components/feed/FeedTabs';
import MoodFilter from '../components/feed/MoodFilter';
import LiveIndicator from '../components/feed/LiveIndicator';
import { postsAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useSocketContext } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import useInfiniteScroll from '../hooks/useInfiniteScroll';
import { toast } from 'react-toastify';
import '../styles/feed.css';

export default function Home() {
  const { user } = useAuth();
  const { socket } = useSocketContext();
  const { updateMoodFromPosts } = useTheme();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState(null);

  const [sortMode, setSortMode] = useState('ranked');
  const [moodFilter, setMoodFilter] = useState('');
  const [newPostCount, setNewPostCount] = useState(0);
  const newPostsRef = useRef([]);

  // ── Load Posts ──────────────────────────────────────────
  // Use a ref for cursor to avoid stale closures in loadMore
  const cursorRef = useRef(null);

  const loadPosts = useCallback(async (isInitial = true, currentCursor = null) => {
    // GUARD: prevent duplicate calls
    if (isInitial) {
      setLoading(true);
      cursorRef.current = null;
      setCursor(null);
    } else {
      if (loadingMore) return; // prevent concurrent load-more calls
      setLoadingMore(true);
    }

    try {
      const params = {
        sort: sortMode,
        limit: 15,
        ...(moodFilter && { mood: moodFilter }),
        ...(!isInitial && currentCursor && { cursor: currentCursor }),
      };
      const { data } = await postsAPI.getAll(params);

      if (isInitial) {
        setPosts(data.posts || []);
        updateMoodFromPosts(data.posts || []);
      } else {
        // DEDUPLICATION: use Map keyed by _id to prevent duplicates
        setPosts((prev) => {
          const merged = [...prev, ...(data.posts || [])];
          return [...new Map(merged.map((p) => [p._id, p])).values()];
        });
      }

      // Update cursor ref AND state
      const nextCursor = data.nextCursor || null;
      cursorRef.current = nextCursor;
      setCursor(nextCursor);
      setHasMore(data.hasMore || false);
    } catch {
      toast.error('Failed to load posts');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [sortMode, moodFilter, loadingMore, updateMoodFromPosts]); // eslint-disable-line

  // Initial load + reset on filter change
  useEffect(() => {
    setPosts([]);
    cursorRef.current = null;
    setCursor(null);
    setNewPostCount(0);
    newPostsRef.current = [];
    loadPosts(true);
  }, [sortMode, moodFilter]); // eslint-disable-line

  // ── Infinite Scroll ────────────────────────────────────
  const loadMore = useCallback(() => {
    // GUARD: only trigger if we have more AND we're not already loading
    if (!hasMore || loadingMore || loading) return;
    const currentCursor = cursorRef.current;
    if (!currentCursor) return;
    loadPosts(false, currentCursor);
  }, [hasMore, loadingMore, loading, loadPosts]);
  const sentinelRef = useInfiniteScroll(loadMore, hasMore, loadingMore);

  // ── Real-Time: New posts via socket ────────────────────
  useEffect(() => {
    if (!socket) return;
    const handler = (newPost) => {
      newPostsRef.current = [newPost, ...newPostsRef.current];
      setNewPostCount((prev) => prev + 1);
    };
    socket.on('new_post', handler);
    return () => socket.off('new_post', handler);
  }, [socket]);

  const revealNewPosts = () => {
    setPosts((prev) => [...newPostsRef.current, ...prev]);
    newPostsRef.current = [];
    setNewPostCount(0);
  };

  // ── Handlers ───────────────────────────────────────────
  const handleNewPost = (post) => {
    setPosts((prev) => [{ ...post, isLiked: false, likesCount: 0, commentsCount: 0 }, ...prev]);
  };

  const handleDelete = async (id) => {
    try {
      await postsAPI.delete(id);
      setPosts((prev) => prev.filter((p) => p._id !== id));
      toast.success('Post deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleSortChange = (mode) => {
    setSortMode(mode);
  };

  const handleMoodChange = (mood) => {
    setMoodFilter(mood);
  };

  return (
    <div className="page">
      <div className="container-wide">
        <div className="feed-layout">
          {/* Main Feed */}
          <div>
            <CreatePost onPostCreated={handleNewPost} />

            <FeedTabs active={sortMode} onChange={handleSortChange} />
            <MoodFilter active={moodFilter} onChange={handleMoodChange} />

            <LiveIndicator count={newPostCount} onClick={revealNewPosts} />

            {loading ? (
              <div className="spinner"><div className="spin" /></div>
            ) : posts.length === 0 ? (
              <div className="card empty-state">
                <div className="empty-state-icon">🌬️</div>
                <p className="empty-state-text">No whispers yet. Be the first to share!</p>
              </div>
            ) : (
              <div className="anim-stagger">
                {posts.map((post, i) => (
                  <div key={post._id} className="anim-slide-in" style={{ animationDelay: `${Math.min(i * 40, 200)}ms` }}>
                    <PostCard post={post} onDelete={handleDelete} />
                  </div>
                ))}

                {/* Infinite scroll sentinel */}
                {hasMore && (
                  <div ref={sentinelRef} style={{ padding: '24px 0', textAlign: 'center' }}>
                    {loadingMore && <div className="spinner"><div className="spin" /></div>}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="feed-sidebar">
            <div className="card about-card">
              <h3>🔒 About The Secret</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                A safe space to share your thoughts, feelings, and ideas — completely anonymously. No judgment, just honest expression.
              </p>
            </div>

            {sortMode === 'ranked' && (
              <div className="card" style={{ marginBottom: 'var(--gap)' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  🧠 Smart Feed
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  Posts are ranked by AI using engagement, recency, quality, and author trust scores.
                </p>
              </div>
            )}

            {!user && (
              <div className="card">
                <h4 style={{ fontWeight: 700, marginBottom: 8 }}>Join The Secret</h4>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                  Sign up for likes, comments, chat, and more.
                </p>
                <a href="/register" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                  Create Account
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
