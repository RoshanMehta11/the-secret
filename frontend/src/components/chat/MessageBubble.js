import React from 'react';

export default function MessageBubble({ message, isOwn }) {
  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const statusIcon = () => {
    if (!isOwn) return null;
    switch (message.status) {
      case 'seen': return <span style={{ color: '#60a5fa' }}>✓✓</span>;
      case 'delivered': return <span>✓✓</span>;
      case 'sent': return <span>✓</span>;
      default: return <span style={{ opacity: 0.5 }}>⏳</span>;
    }
  };

  return (
    <div className={`msg-bubble ${isOwn ? 'msg-own' : 'msg-other'}`}>
      <div>{message.content || message.ciphertext || '[Encrypted]'}</div>
      <div className="msg-status">
        <span className="msg-time">{time}</span>
        {statusIcon()}
      </div>
    </div>
  );
}
