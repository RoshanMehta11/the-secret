import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

// ─── Chatroom Context ─────────────────────────────────────────────
// Manages the /chatrooms Socket.IO namespace connection and room state.
// Delivery model: AT-MOST-ONCE — clients deduplicate by seqId.

const SOCKET_URL = process.env.REACT_APP_API_URL
  ? process.env.REACT_APP_API_URL.replace('/api', '')
  : 'http://localhost:5000';

const ChatroomContext = createContext(null);

export function ChatroomProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [participantCount, setParticipantCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState(new Map());
  const [roomExpired, setRoomExpired] = useState(false);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Connect to /chatrooms namespace
  const connectNamespace = useCallback(() => {
    if (socketRef.current?.connected) return socketRef.current;

    const token = localStorage.getItem('token');
    if (!token) return null;

    const sock = io(`${SOCKET_URL}/chatrooms`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    sock.on('connect', () => {
      console.log('🏠 Chatroom namespace connected');
      setConnected(true);
    });

    sock.on('disconnect', () => {
      console.log('🏠 Chatroom namespace disconnected');
      setConnected(false);
    });

    sock.on('connect_error', (err) => {
      console.error('Chatroom socket error:', err.message);
    });

    // ── Message handling with seqId deduplication ─────────────
    sock.on('chatroom:message', (msg) => {
      setMessages((prev) => {
        // Deduplicate by seqId
        if (prev.some((m) => m.seqId === msg.seqId)) return prev;
        // Insert maintaining seqId order
        const next = [...prev, msg].sort((a, b) => a.seqId - b.seqId);
        return next;
      });
    });

    // Late-joiner history
    sock.on('chatroom:history', ({ messages: histMsgs }) => {
      if (histMsgs && histMsgs.length > 0) {
        setMessages(histMsgs.sort((a, b) => a.seqId - b.seqId));
      }
    });

    // ── Join/Leave notifications ──────────────────────────────
    sock.on('chatroom:user_joined', ({ displayName, participantCount: count }) => {
      setParticipantCount(count);
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-join-${Date.now()}-${Math.random()}`,
          type: 'system',
          text: `${displayName} joined the room`,
          timestamp: Date.now(),
        },
      ]);
    });

    sock.on('chatroom:user_left', ({ displayName, participantCount: count }) => {
      setParticipantCount(count);
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-leave-${Date.now()}-${Math.random()}`,
          type: 'system',
          text: `${displayName} left the room`,
          timestamp: Date.now(),
        },
      ]);
    });

    // ── Typing indicator ──────────────────────────────────────
    sock.on('chatroom:typing', ({ userId, displayName, isTyping }) => {
      setTypingUsers((prev) => {
        const next = new Map(prev);
        if (isTyping) next.set(userId, displayName);
        else next.delete(userId);
        return next;
      });
    });

    // ── Room lifecycle events ─────────────────────────────────
    sock.on('chatroom:room_expired', () => setRoomExpired(true));
    sock.on('chatroom:room_closed', () => setRoomExpired(true));

    sock.on('chatroom:reconnected', ({ roomId, roomName }) => {
      console.log(`Reconnected to room: ${roomName}`);
    });

    sock.on('chatroom:error', ({ code, roomId }) => {
      setError({ code, roomId });
      // Auto-clear error after 5s
      setTimeout(() => setError(null), 5000);
    });

    socketRef.current = sock;
    setSocket(sock);
    return sock;
  }, []);

  // Disconnect namespace
  const disconnectNamespace = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
    }
  }, []);

  // ── Room Actions ────────────────────────────────────────────

  const joinRoom = useCallback((roomId) => {
    const sock = socketRef.current || connectNamespace();
    if (!sock) return;
    // Reset state for new room
    setMessages([]);
    setTypingUsers(new Map());
    setRoomExpired(false);
    setError(null);
    setParticipantCount(0);
    sock.emit('chatroom:join', { roomId });
  }, [connectNamespace]);

  const leaveRoom = useCallback((roomId) => {
    if (socketRef.current) {
      socketRef.current.emit('chatroom:leave', { roomId });
    }
    setCurrentRoom(null);
    setMessages([]);
    setTypingUsers(new Map());
    setRoomExpired(false);
  }, []);

  const sendMessage = useCallback((roomId, text) => {
    if (socketRef.current?.connected && text.trim()) {
      socketRef.current.emit('chatroom:send_message', { roomId, text: text.trim() });
    }
  }, []);

  const sendTyping = useCallback((roomId, isTyping) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('chatroom:typing', { roomId, isTyping });
    }
  }, []);

  // Auto typing stop after 3s
  const handleTyping = useCallback((roomId) => {
    sendTyping(roomId, true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => sendTyping(roomId, false), 3000);
  }, [sendTyping]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectNamespace();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [disconnectNamespace]);

  const value = {
    socket,
    connected,
    currentRoom,
    setCurrentRoom,
    messages,
    participantCount,
    typingUsers,
    roomExpired,
    error,
    connectNamespace,
    disconnectNamespace,
    joinRoom,
    leaveRoom,
    sendMessage,
    handleTyping,
    sendTyping,
  };

  return (
    <ChatroomContext.Provider value={value}>
      {children}
    </ChatroomContext.Provider>
  );
}

export function useChatroom() {
  const ctx = useContext(ChatroomContext);
  if (!ctx) {
    return {
      socket: null, connected: false, currentRoom: null,
      setCurrentRoom: () => {}, messages: [], participantCount: 0,
      typingUsers: new Map(), roomExpired: false, error: null,
      connectNamespace: () => {}, disconnectNamespace: () => {},
      joinRoom: () => {}, leaveRoom: () => {}, sendMessage: () => {},
      handleTyping: () => {}, sendTyping: () => {},
    };
  }
  return ctx;
}
