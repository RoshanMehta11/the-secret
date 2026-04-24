/**
 * Anonymous Identity Generator
 * Creates deterministic geometric avatars from user IDs.
 * Same user always gets the same avatar — no deanonymization risk.
 */

// Simple hash function (djb2)
function hashStr(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit
  }
  return Math.abs(hash);
}

// Generate HSL color from hash — vibrant, not muddy
function hashToColor(hash, offset = 0) {
  const hue = (hash + offset * 137) % 360;
  const sat = 55 + (hash % 30); // 55-85%
  const light = 55 + (hash % 20); // 55-75%
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

// The 6 geometric shape paths (viewBox 0 0 100 100)
const SHAPES = [
  // Triangle
  'M50 15 L85 80 H15 Z',
  // Circle
  'M50 20 A30 30 0 1 1 50 80 A30 30 0 1 1 50 20',
  // Diamond
  'M50 10 L85 50 L50 90 L15 50 Z',
  // Hexagon
  'M50 15 L82 32 L82 68 L50 85 L18 68 L18 32 Z',
  // Square (rotated 15deg feel)
  'M25 25 H75 V75 H25 Z',
  // Star
  'M50 15 L59 40 L85 40 L64 55 L72 80 L50 65 L28 80 L36 55 L15 40 L41 40 Z',
];

/**
 * Generate SVG avatar string from a user ID or any string
 */
export function generateAvatar(userId, size = 40) {
  const hash = hashStr(userId || 'anon');
  const hash2 = hashStr(userId ? userId + '_bg' : 'anon_bg');

  const bgColor = hashToColor(hash, 0);
  const shapeColor = hashToColor(hash2, 3);
  const shapeIdx = hash % SHAPES.length;
  const shape2Idx = (hash2) % SHAPES.length;

  // Compose 2 shapes for more uniqueness
  const rotation = (hash % 6) * 60;
  const scale = 0.4 + (hash % 3) * 0.1;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">
    <rect width="100" height="100" rx="20" fill="${bgColor}" opacity="0.2"/>
    <g transform="rotate(${rotation} 50 50)">
      <path d="${SHAPES[shapeIdx]}" fill="${bgColor}" opacity="0.7"/>
    </g>
    <g transform="scale(${scale}) translate(${50 / scale - 50} ${50 / scale - 50})">
      <path d="${SHAPES[shape2Idx]}" fill="${shapeColor}" opacity="0.9"/>
    </g>
  </svg>`;
}

/**
 * Get a short anonymous identifier (e.g., "#a7f3")
 */
export function getAnonTag(userId) {
  if (!userId) return '#anon';
  const hash = hashStr(userId);
  return '#' + hash.toString(16).slice(0, 4);
}

/**
 * Get the primary color for a user
 */
export function getUserColor(userId) {
  return hashToColor(hashStr(userId || 'anon'));
}
