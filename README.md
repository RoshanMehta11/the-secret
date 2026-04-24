# 🔒 The Secret — Next-Gen Anonymous Social Platform

A research-grade, real-time, anonymous social platform built with the MERN stack. Features mood-adaptive UI, AI-powered smart feed, privacy-preserving anonymous messaging, and floating chat system.

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| 🎭 **Anonymous Posting** | Share secrets without identity exposure |
| 🧠 **Smart Feed** | AI-ranked posts using engagement, recency, and trust scores |
| 😔😤🌟🎲 **Mood System** | Posts tagged as Confession, Rant, Positive, or Random |
| 💬 **Floating Chat** | Messenger-style overlay with multiple concurrent windows |
| 🔒 **Anonymous Messaging** | Message post authors without knowing their identity |
| 📡 **Real-Time** | Socket.IO for live posts, messages, and notifications |
| 🛡️ **AI Moderation** | Toxicity scoring and auto-flagging pipeline |
| 📊 **Admin Dashboard** | Analytics, user management, moderation queue |
| 🎨 **Mood-Adaptive UI** | Theme colors shift based on feed content |
| 🔐 **Security** | Helmet, rate limiting, input sanitization, JWT auth |

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, React Router v6, Socket.IO Client |
| **Backend** | Node.js, Express.js, Socket.IO |
| **Database** | MongoDB + Mongoose |
| **Cache/Pub-Sub** | Redis |
| **Auth** | JWT + Google OAuth 2.0 |
| **Security** | Helmet, express-rate-limit, mongo-sanitize, bcryptjs |

---

## 📁 Project Structure

```
the-secret/
├── backend/
│   ├── config/          # Database & Redis configuration
│   ├── controllers/     # Auth, Post, Chat, Admin, User controllers
│   ├── middleware/       # JWT auth, admin guard
│   ├── models/          # User, Post, Comment, Report, Conversation, Message
│   ├── routes/          # API routes
│   ├── services/        # Moderation, Feed scoring, Event bus
│   ├── server.js        # Express + Socket.IO entry point
│   └── seedPosts.js     # Seed script (55 realistic posts)
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/      # Navbar, PostCard, CreatePost, AnonAvatar
│   │   │   ├── chat/        # ChatFloat, ChatWindow, ConvoList, MessageBubble
│   │   │   ├── feed/        # FeedTabs, MoodFilter, LiveIndicator
│   │   │   └── notifications/
│   │   ├── context/         # AuthContext, SocketContext, ThemeContext, ChatContext
│   │   ├── hooks/           # useInfiniteScroll
│   │   ├── pages/           # Home, Login, Register, Profile, Admin/*
│   │   ├── styles/          # global.css, feed.css, chat.css
│   │   └── utils/           # api.js, socket.js, moodEngine.js, anonIdentity.js
│   └── public/
│
├── .gitignore
└── README.md
```

---

## 🚀 Setup Instructions

### Prerequisites

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | v18+ | Runtime |
| MongoDB | v6+ | Database |
| Redis | v7+ | Cache & Socket.IO adapter |

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/the-secret.git
cd the-secret
```

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your values (see below)
node server.js
```

### 3. Frontend Setup (new terminal)
```bash
cd frontend
npm install
npm start
```

### 4. (Optional) Seed Sample Posts
```bash
cd backend
node seedPosts.js
```

---

## ⚙️ Environment Variables

### `backend/.env`
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/the-secret
JWT_SECRET=your_very_long_random_secret_here
JWT_EXPIRE=7d
GOOGLE_CLIENT_ID=your_google_oauth_client_id
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

### `frontend/.env`
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
```

---

## 📡 API Reference

### Auth (`/api/auth`)
| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| POST | `/register` | Register new user | Public |
| POST | `/login` | Email/password login | Public |
| POST | `/google` | Google OAuth login | Public |
| GET | `/me` | Get current user | Protected |

### Posts (`/api/posts`)
| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| GET | `/` | Smart feed (paginated, filterable) | Optional |
| POST | `/` | Create post with mood | Optional |
| DELETE | `/:id` | Delete own post | Protected |
| PUT | `/:id/like` | Toggle like | Protected |
| GET | `/:id/comments` | Get comments | Optional |
| POST | `/:id/comments` | Add comment | Optional |
| POST | `/:id/report` | Report post | Optional |

### Chat (`/api/chat`)
| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| POST | `/conversations/from-post` | Start anonymous chat from post | Protected |
| POST | `/conversations` | Start direct conversation | Protected |
| GET | `/conversations` | List conversations | Protected |
| GET | `/conversations/:id/messages` | Get messages | Protected |
| POST | `/conversations/:id/messages` | Send message | Protected |

### Admin (`/api/admin`) — Admin only
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/stats` | Dashboard statistics |
| GET | `/users` | List all users |
| PUT | `/users/:id/ban` | Ban/unban user |
| PUT | `/users/:id/role` | Change user role |

---

## 🔐 Security

- **JWT Authentication** with refresh token support
- **IP Hashing** — SHA-256, never stored as plaintext
- **Helmet** — HTTP security headers
- **Rate Limiting** — API abuse prevention
- **Input Sanitization** — MongoDB injection protection
- **CORS** — Restricted origin access
- **Anonymous Identity** — No personal identifiers linked to posts

---

## 👤 Creating Admin User

After registering, promote via MongoDB shell:
```js
db.users.updateOne({ email: "your@email.com" }, { $set: { role: "admin" } })
```

---


## 📄 License

MIT License — See [LICENSE](LICENSE) for details.
