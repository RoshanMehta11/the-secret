import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './styles/global.css';

import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ThemeProvider } from './context/ThemeContext';
import { ChatProvider } from './context/ChatContext';
import { ChatroomProvider } from './context/ChatroomContext';
import Navbar from './components/common/Navbar';
import ChatFloat from './components/chat/ChatFloat';
import NotifToast from './components/notifications/NotifToast';

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/user/Profile';
import Notifications from './pages/Notifications';
import AdminLayout from './pages/admin/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import AdminUsers from './pages/admin/Users';
import AdminPosts from './pages/admin/Posts';
import AdminReports from './pages/admin/Reports';
import Moderation from './pages/admin/Moderation';
import Analytics from './pages/admin/Analytics';
import Chatrooms from './pages/Chatrooms';
import ChatroomUI from './components/chatrooms/ChatroomUI';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="spinner"><div className="spin" /></div>;
  return user ? children : <Navigate to="/login" replace />;
}

function AppContent() {
  const { user } = useAuth();

  return (
    <SocketProvider user={user}>
      <ThemeProvider>
        <ChatProvider>
        <ChatroomProvider>
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="posts" element={<AdminPosts />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="moderation" element={<Moderation />} />
            <Route path="analytics" element={<Analytics />} />
          </Route>
          <Route path="/chatrooms" element={<ProtectedRoute><Chatrooms /></ProtectedRoute>} />
          <Route path="/chatrooms/:roomId" element={<ProtectedRoute><ChatroomUI /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        {/* Floating systems — always present */}
        <ChatFloat />
        <NotifToast />
        </ChatroomProvider>
        </ChatProvider>
      </ThemeProvider>
    </SocketProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
        <ToastContainer
          position="bottom-right"
          autoClose={3000}
          theme="dark"
          toastStyle={{ background: '#1e1e3f', border: '1px solid #2d2d5e' }}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}
