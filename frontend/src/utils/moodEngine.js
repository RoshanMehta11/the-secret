/**
 * Mood Engine
 * Maps post moods to visual themes and detects mood from content.
 */

export const MOODS = {
  confession: {
    label: 'Confession',
    emoji: '😔',
    gradient: 'linear-gradient(135deg, #1a1a4e 0%, #2d1b69 100%)',
    border: '#6366f1',
    bg: 'rgba(99, 102, 241, 0.08)',
    text: '#a5b4fc',
    glow: 'rgba(99, 102, 241, 0.3)',
    accent: '#818cf8',
  },
  rant: {
    label: 'Rant',
    emoji: '😡',
    gradient: 'linear-gradient(135deg, #3b1010 0%, #4a1a1a 100%)',
    border: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.08)',
    text: '#fca5a5',
    glow: 'rgba(239, 68, 68, 0.3)',
    accent: '#f87171',
  },
  positive: {
    label: 'Positive',
    emoji: '😊',
    gradient: 'linear-gradient(135deg, #0a2e1a 0%, #1a3d2a 100%)',
    border: '#10b981',
    bg: 'rgba(16, 185, 129, 0.08)',
    text: '#6ee7b7',
    glow: 'rgba(16, 185, 129, 0.3)',
    accent: '#34d399',
  },
  random: {
    label: 'Random',
    emoji: '🎭',
    gradient: 'linear-gradient(135deg, #1e1b4b 0%, #2d1a4e 100%)',
    border: '#7c3aed',
    bg: 'rgba(124, 58, 237, 0.08)',
    text: '#c4b5fd',
    glow: 'rgba(124, 58, 237, 0.3)',
    accent: '#a78bfa',
  },
};

/**
 * Get mood theme for a post
 */
export function getMoodTheme(mood) {
  return MOODS[mood] || MOODS.random;
}

/**
 * Get dominant mood from an array of posts
 * Used to set page-level ambient theme
 */
export function getDominantMood(posts) {
  if (!posts || posts.length === 0) return 'random';

  const counts = {};
  posts.forEach((p) => {
    const m = p.mood || 'random';
    counts[m] = (counts[m] || 0) + 1;
  });

  let maxMood = 'random';
  let maxCount = 0;
  Object.entries(counts).forEach(([mood, count]) => {
    if (count > maxCount) {
      maxCount = count;
      maxMood = mood;
    }
  });

  return maxMood;
}

/**
 * Auto-detect mood from content text (simple heuristic)
 */
export function detectMood(text) {
  if (!text) return 'random';
  const lower = text.toLowerCase();

  const confessionWords = ['confess', 'secret', 'nobody knows', 'ashamed', 'guilty', 'regret', 'sorry', 'afraid', 'scared', 'never told'];
  const rantWords = ['hate', 'angry', 'furious', 'annoyed', 'frustrated', 'sick of', 'tired of', 'worst', 'stupid', 'unfair', 'wtf', 'smh'];
  const positiveWords = ['happy', 'love', 'grateful', 'amazing', 'beautiful', 'blessed', 'thankful', 'excited', 'proud', 'hope', 'wonderful'];

  const confScore = confessionWords.filter((w) => lower.includes(w)).length;
  const rantScore = rantWords.filter((w) => lower.includes(w)).length;
  const posScore = positiveWords.filter((w) => lower.includes(w)).length;

  if (confScore > rantScore && confScore > posScore && confScore > 0) return 'confession';
  if (rantScore > confScore && rantScore > posScore && rantScore > 0) return 'rant';
  if (posScore > confScore && posScore > rantScore && posScore > 0) return 'positive';
  return 'random';
}
