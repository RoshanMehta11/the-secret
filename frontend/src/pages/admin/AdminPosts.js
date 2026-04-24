import React, { useEffect, useState } from 'react';
import { adminAPI } from '../../utils/api';
import toast from 'react-hot-toast';
import './Admin.css';

const AdminPosts = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});

  const fetchPosts = async (p = 1, s = status) => {
    setLoading(true);
    try {
      const res = await adminAPI.getPosts({ page: p, limit: 20, status: s });
      setPosts(res.data.posts);
      setPagination(res.data.pagination);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
    // eslint-disable-next-line
  }, []);

  const handleStatusChange = (newStatus) => {
    setStatus(newStatus);
    setPage(1);
    fetchPosts(1, newStatus);
  };

  const handleUpdateStatus = async (postId, newStatus) => {
    try {
      await adminAPI.updatePostStatus(postId, { status: newStatus });
      toast.success('Post status updated');
      fetchPosts(page);
    } catch {
      toast.error('Update failed');
    }
  };

  const handleToggleHide = async (postId, currentHidden) => {
    try {
      await adminAPI.updatePostStatus(postId, { isHidden: !currentHidden });
      toast.success(currentHidden ? 'Post visible' : 'Post hidden');
      fetchPosts(page);
    } catch {
      toast.error('Update failed');
    }
  };

  const handleDelete = async (postId) => {
    if (!window.confirm('Delete this post permanently?')) return;
    try {
      await adminAPI.deletePost(postId);
      toast.success('Post deleted');
      fetchPosts(page);
    } catch {
      toast.error('Delete failed');
    }
  };

  return (
    <div>
      <h2 className="page-title">Posts Management</h2>

      <div className="admin-filters">
        <select
          value={status}
          onChange={(e) => handleStatusChange(e.target.value)}
        >
          <option value="">All Posts</option>
          <option value="active">Active</option>
          <option value="flagged">Flagged</option>
          <option value="removed">Removed</option>
        </select>
        <span className="text-muted" style={{ alignSelf: 'center' }}>
          {pagination.total || 0} posts
        </span>
      </div>

      <div className="card admin-table-wrap">
        {loading ? (
          <div className="flex-center" style={{ padding: '40px' }}><div className="spinner" /></div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Content</th>
                <th>Author</th>
                <th>Category</th>
                <th>Status</th>
                <th>Reports</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post._id}>
                  <td style={{ maxWidth: 200 }}>
                    <p style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {post.isHidden && <span className="badge badge-danger" style={{ marginRight: 6 }}>Hidden</span>}
                      {post.content}
                    </p>
                  </td>
                  <td className="text-muted">
                    {post.isAnonymous ? '🕵️ Anon' : `@${post.author?.username || 'deleted'}`}
                  </td>
                  <td><span className="badge badge-primary">{post.category}</span></td>
                  <td>
                    <span className={`badge badge-${post.status === 'active' ? 'success' : post.status === 'flagged' ? 'warning' : 'danger'}`}>
                      {post.status}
                    </span>
                  </td>
                  <td style={{ color: post.reportCount > 0 ? 'var(--danger)' : 'inherit' }}>
                    {post.reportCount || 0}
                  </td>
                  <td className="text-muted">{new Date(post.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleToggleHide(post._id, post.isHidden)}
                      >
                        {post.isHidden ? 'Show' : 'Hide'}
                      </button>
                      {post.status !== 'removed' && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleUpdateStatus(post._id, 'removed')}
                        >
                          Remove
                        </button>
                      )}
                      {post.status === 'removed' && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleUpdateStatus(post._id, 'active')}
                        >
                          Restore
                        </button>
                      )}
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(post._id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {posts.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                    No posts found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {pagination.pages > 1 && (
        <div className="page-nav">
          <button className="btn btn-ghost btn-sm" onClick={() => { setPage(page - 1); fetchPosts(page - 1); }} disabled={page === 1}>← Prev</button>
          <span>Page {page} of {pagination.pages}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => { setPage(page + 1); fetchPosts(page + 1); }} disabled={page >= pagination.pages}>Next →</button>
        </div>
      )}
    </div>
  );
};

export default AdminPosts;
