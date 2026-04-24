import React, { createContext, useContext, useState, useCallback } from 'react';
import { MOODS, getDominantMood } from '../utils/moodEngine';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [activeMood, setActiveMood] = useState('random');

  const updateMoodFromPosts = useCallback((posts) => {
    const dominant = getDominantMood(posts);
    setActiveMood(dominant);
  }, []);

  const moodTheme = MOODS[activeMood] || MOODS.random;

  // CSS variables for mood-adaptive styling
  const moodStyle = {
    '--mood-border': moodTheme.border,
    '--mood-bg': moodTheme.bg,
    '--mood-glow': moodTheme.glow,
    '--mood-accent': moodTheme.accent,
  };

  return (
    <ThemeContext.Provider value={{ activeMood, setActiveMood, updateMoodFromPosts, moodTheme, moodStyle }}>
      <div style={moodStyle} className="anim-mood">
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) return {
    activeMood: 'random',
    setActiveMood: () => {},
    updateMoodFromPosts: () => {},
    moodTheme: MOODS.random,
    moodStyle: {},
  };
  return ctx;
}
