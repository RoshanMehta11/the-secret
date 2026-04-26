import React from 'react';

export default function MessageBubble({ message, isOwn }) {
  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const statusIcon = () => {
    if (!isOwn) return null;
    switch (message.status) {
      case 'seen':     return <span style={{ color: '#60a5fa' }}>✓✓</span>;
      case 'delivered': return <span>✓✓</span>;
      case 'sent':     return <span>✓</span>;
      case 'failed':   return <span style={{ color: '#f87171' }}>✗</span>;
      default:         return <span style={{ opacity: 0.5 }}>⏳</span>;
    }
  };

  return (
    // Row wrapper provides the LEFT / RIGHT alignment via flexbox
    <div className={`message-row ${isOwn ? 'row-right' : 'row-left'}`}>
      <div className={`msg-bubble ${isOwn ? 'msg-own' : 'msg-other'} ${message.status === 'failed' ? 'msg-failed' : ''}`}>
        <div>{message.content || message.ciphertext || '[Encrypted]'}</div>
        <div className="msg-status">
          <span className="msg-time">{time}</span>
          {statusIcon()}
        </div>
      </div>
    </div>
  );
}
