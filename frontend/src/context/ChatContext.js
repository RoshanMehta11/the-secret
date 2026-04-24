import React, { createContext, useContext, useState, useCallback } from 'react';

/**
 * ChatContext — Bridge between any component and the floating chat system.
 * Allows PostCard (or any component) to open a conversation in ChatFloat
 * without tight coupling.
 */
const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  // Queue of conversations to open (consumed by ChatFloat)
  const [pendingChat, setPendingChat] = useState(null);

  const openChat = useCallback((conversation) => {
    setPendingChat(conversation);
  }, []);

  const consumePendingChat = useCallback(() => {
    const chat = pendingChat;
    setPendingChat(null);
    return chat;
  }, [pendingChat]);

  return (
    <ChatContext.Provider value={{ pendingChat, openChat, consumePendingChat }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx) return { pendingChat: null, openChat: () => {}, consumePendingChat: () => null };
  return ctx;
}
