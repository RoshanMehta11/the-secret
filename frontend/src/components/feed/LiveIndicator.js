import React from 'react';

export default function LiveIndicator({ count, onClick }) {
  if (!count || count <= 0) return null;

  return (
    <div className="live-indicator">
      <button className="live-pill" onClick={onClick}>
        <span className="live-pill-dot" />
        🔮 {count} new whisper{count > 1 ? 's' : ''}
      </button>
    </div>
  );
}
