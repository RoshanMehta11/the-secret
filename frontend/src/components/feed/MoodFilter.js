import React from 'react';
import { MOODS } from '../../utils/moodEngine';

const MOOD_OPTIONS = [
  { key: '', label: 'All', emoji: '✨' },
  ...Object.entries(MOODS).map(([key, val]) => ({
    key,
    label: val.label,
    emoji: val.emoji,
  })),
];

export default function MoodFilter({ active, onChange }) {
  return (
    <div className="mood-filter">
      {MOOD_OPTIONS.map((mood) => (
        <button
          key={mood.key}
          className={`mood-chip ${active === mood.key ? 'active' : ''}`}
          onClick={() => onChange(mood.key)}
          style={
            active === mood.key && mood.key
              ? {
                  '--mood-border': MOODS[mood.key]?.border,
                  '--mood-bg': MOODS[mood.key]?.bg,
                  '--mood-accent': MOODS[mood.key]?.accent,
                }
              : {}
          }
        >
          {mood.emoji} {mood.label}
        </button>
      ))}
    </div>
  );
}
