import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { connectSocket, disconnectSocket, getSocket, sendHeartbeat } from '../utils/socket';
import { notificationAPI, chatAPI } from '../utils/api';

const SocketContext = createContext(null);

export function SocketProvider({ children, user }) {
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [typingUsers, setTypingUsers] = useState(new Map()); // convId -> Set<userId>
  const [notifications, setNotifications] = useState([]); // recent toasts
  const heartbeatRef = useRef(null);

  // Connect socket when user is logged in
  useEffect(() => {
    if (!user) {
      disconnectSocket();
      setConnected(false);
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    const socket = connectSocket(token);

    const userId = user.id || user._id;

    socket.on('connect', () => {
      setConnected(true);
      // CRITICAL: register this socket with the server so direct messages work
      socket.emit('register', userId);
    });

    socket.on('reconnect', () => {
      // Re-register after reconnection so presence + direct delivery is restored
      socket.emit('register', userId);
    });

    socket.on('disconnect', () => setConnected(false));

    // ── Presence Events ────────────────────────────────
    socket.on('user_online', ({ userId }) => {
      setOnlineUsers((prev) => new Set([...prev, userId]));
    });

    socket.on('user_offline', ({ userId }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    });

    // ── Notification Events ────────────────────────────
    socket.on('notification', (notif) => {
      setUnreadNotifs((prev) => prev + 1);
      setNotifications((prev) => [notif, ...prev.slice(0, 4)]); // Keep last 5 toasts
    });

    socket.on('notification_count', ({ unreadCount }) => {
      setUnreadNotifs(unreadCount);
    });

    // ── Chat Events ────────────────────────────────────
    socket.on('message_notification', () => {
      setUnreadMessages((prev) => prev + 1);
    });

    socket.on('new_message', () => {
      setUnreadMessages((prev) => prev + 1);
    });

    socket.on('user_typing', ({ conversationId, userId, isTyping }) => {
      setTypingUsers((prev) => {
        const next = new Map(prev);
        const convTyping = new Set(next.get(conversationId) || []);
        if (isTyping) convTyping.add(userId);
        else convTyping.delete(userId);
        if (convTyping.size === 0) next.delete(conversationId);
        else next.set(conversationId, convTyping);
        return next;
      });
    });

    // ── Heartbeat ──────────────────────────────────────
    heartbeatRef.current = setInterval(sendHeartbeat, 30000);

    return () => {
      clearInterval(heartbeatRef.current);
      disconnectSocket();
    };
  }, [user]);

  // Fetch initial counts
  useEffect(() => {
    if (!user) return;
    notificationAPI.getUnreadCount()
      .then(({ data }) => setUnreadNotifs(data.unreadCount || 0))
      .catch(() => {});
    chatAPI.getUnreadCount()
      .then(({ data }) => setUnreadMessages(data.unreadCount || 0))
      .catch(() => {});
  }, [user]);

  const isUserOnline = useCallback((userId) => onlineUsers.has(userId), [onlineUsers]);

  const dismissToast = useCallback((index) => {
    setNotifications((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearUnreadMessages = useCallback(() => setUnreadMessages(0), []);

  const value = {
    connected,
    socket: getSocket(),
    onlineUsers,
    isUserOnline,
    unreadNotifs,
    setUnreadNotifs,
    unreadMessages,
    setUnreadMessages,
    clearUnreadMessages,
    typingUsers,
    notifications,
    dismissToast,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocketContext() {
  const ctx = useContext(SocketContext);
  if (!ctx) return {
    connected: false, socket: null, onlineUsers: new Set(),
    isUserOnline: () => false, unreadNotifs: 0, unreadMessages: 0,
    typingUsers: new Map(), notifications: [], dismissToast: () => {},
    setUnreadNotifs: () => {}, setUnreadMessages: () => {}, clearUnreadMessages: () => {},
  };
  return ctx;
}
