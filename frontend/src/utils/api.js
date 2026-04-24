import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

// ── Request Interceptor: Attach token ────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response Interceptor: Token refresh on 401 ───────────────
let isRefreshing = false;
let refreshQueue = [];

const processQueue = (error, token = null) => {
  refreshQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  refreshQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;

    // Only try refresh on 401, and not on auth endpoints themselves
    if (
      err.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const { data } = await axios.post(
            `${api.defaults.baseURL}/auth/refresh`,
            { refreshToken }
          );
          localStorage.setItem('token', data.token);
          if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
          processQueue(null, data.token);
          originalRequest.headers.Authorization = `Bearer ${data.token}`;
          return api(originalRequest);
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    // Non-401 errors or auth endpoint 401s
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ═══════════════════════════════════════════════════════════
// API MODULES
// ═══════════════════════════════════════════════════════════

// Auth
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  googleLogin: (credential) => api.post('/auth/google', { credential }),
  getMe: () => api.get('/auth/me'),
  refresh: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
  logout: () => api.post('/auth/logout'),
};

// Posts (supports smart feed, trending, latest)
export const postsAPI = {
  getAll: (params) => api.get('/posts', { params }),
  getOne: (id) => api.get(`/posts/${id}`),
  create: (data) => api.post('/posts', data),
  delete: (id) => api.delete(`/posts/${id}`),
  like: (id) => api.put(`/posts/${id}/like`),
  getComments: (id) => api.get(`/posts/${id}/comments`),
  addComment: (id, data) => api.post(`/posts/${id}/comments`, data),
  report: (id, data) => api.post(`/posts/${id}/report`, data),
};

// Chat
export const chatAPI = {
  getConversations: () => api.get('/chat/conversations'),
  startConversation: (recipientId) => api.post('/chat/conversations', { recipientId }),
  startFromPost: (postId) => api.post('/chat/conversations/from-post', { postId }),
  getMessages: (convId, params) => api.get(`/chat/conversations/${convId}/messages`, { params }),
  sendMessage: (convId, data) => api.post(`/chat/conversations/${convId}/messages`, data),
  getUnreadCount: () => api.get('/chat/unread'),
  uploadPublicKey: (publicKey) => api.put('/chat/pubkey', { publicKey }),
  getPublicKey: (userId) => api.get(`/chat/users/${userId}/pubkey`),
};

// Notifications
export const notificationAPI = {
  getAll: (params) => api.get('/notifications', { params }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAsRead: (notificationIds) => api.put('/notifications/read', { notificationIds }),
  markAllRead: () => api.put('/notifications/read', { all: true }),
};

// Users
export const usersAPI = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data) => api.put('/users/profile', data),
  changePassword: (data) => api.put('/users/password', data),
  getMyPosts: (params) => api.get('/users/my-posts', { params }),
};

// Admin
export const adminAPI = {
  getStats: () => api.get('/admin/stats'),
  getUsers: (params) => api.get('/admin/users', { params }),
  banUser: (id, data) => api.put(`/admin/users/${id}/ban`, data),
  changeRole: (id, data) => api.put(`/admin/users/${id}/role`, data),
  getPosts: (params) => api.get('/admin/posts', { params }),
  hidePost: (id) => api.put(`/admin/posts/${id}/hide`),
  deletePost: (id) => api.delete(`/admin/posts/${id}`),
  getReports: (params) => api.get('/admin/reports', { params }),
  updateReport: (id, data) => api.put(`/admin/reports/${id}`, data),
  // Moderation
  getModerationQueue: (params) => api.get('/admin/moderation/queue', { params }),
  reviewModeration: (id, data) => api.put(`/admin/moderation/${id}/review`, data),
  getModerationStats: () => api.get('/admin/moderation/stats'),
  updateBlocklist: (data) => api.put('/admin/moderation/blocklist', data),
};

export default api;
