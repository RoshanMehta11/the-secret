import React from 'react';

const TABS = [
  { key: 'ranked', label: '🧠 Smart', desc: 'AI-ranked feed' },
  { key: 'trending', label: '🔥 Trending', desc: 'Hot right now' },
  { key: 'latest', label: '🕐 Latest', desc: 'Newest first' },
];

export default function FeedTabs({ active, onChange }) {
  return (
    <div className="feed-tabs">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          className={`feed-tab ${active === tab.key ? 'active' : ''}`}
          onClick={() => onChange(tab.key)}
          title={tab.desc}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
