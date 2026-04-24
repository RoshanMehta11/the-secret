import React, { useMemo } from 'react';
import { generateAvatar, getAnonTag, getUserColor } from '../../utils/anonIdentity';

/**
 * Deterministic anonymous avatar component.
 * Same userId always produces the same unique geometric avatar.
 */
export default function AnonAvatar({ userId, size = 36, showTag = false, className = '' }) {
  const svgHtml = useMemo(() => generateAvatar(userId, size), [userId, size]);
  const tag = useMemo(() => getAnonTag(userId), [userId]);
  const color = useMemo(() => getUserColor(userId), [userId]);

  return (
    <div className={`anon-avatar ${className}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 8,
          overflow: 'hidden',
          flexShrink: 0,
          background: `${color}22`,
        }}
        dangerouslySetInnerHTML={{ __html: svgHtml }}
      />
      {showTag && (
        <span style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: "'Courier New', monospace", fontWeight: 500 }}>
          {tag}
        </span>
      )}
    </div>
  );
}
