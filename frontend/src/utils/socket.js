import { io } from 'socket.io-client';

let socket = null;
const listeners = new Map();

const SOCKET_URL = process.env.REACT_APP_API_URL
  ? process.env.REACT_APP_API_URL.replace('/api', '')
  : 'http://localhost:5000';

export function connectSocket(token) {
  if (socket?.connected) return socket;

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 15,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect', () => {
    console.log('🔒 Socket connected');
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.error('Socket error:', err.message);
  });

  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    listeners.clear();
  }
}

/**
 * Subscribe to a socket event. Returns unsubscribe function.
 */
export function onSocketEvent(event, callback) {
  if (!socket) return () => {};

  socket.on(event, callback);

  // Track listener for cleanup
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(callback);

  return () => {
    socket?.off(event, callback);
    listeners.get(event)?.delete(callback);
  };
}

/**
 * Emit a socket event
 */
export function emitSocketEvent(event, data) {
  if (socket?.connected) {
    socket.emit(event, data);
  }
}

/**
 * Send heartbeat for presence
 */
export function sendHeartbeat() {
  emitSocketEvent('heartbeat', { timestamp: Date.now() });
}
