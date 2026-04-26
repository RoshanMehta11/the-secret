import React, { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { toast } from 'react-toastify';

export default function ShareProfileModal({ userId, username, onClose }) {
  const [profileUrl, setProfileUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Fetch the secure share data from the backend
  useEffect(() => {
    const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
    fetch(`${apiBase}/users/${userId}/share`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setProfileUrl(data.profileUrl);
        }
      })
      .catch(() => {
        // Fallback to client-side URL if fetch fails
        setProfileUrl(`${window.location.origin}/profile/${userId}`);
      })
      .finally(() => setLoading(false));
  }, [userId]);

  // Copy link to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy link');
    }
  };

  // Native Share API (mobile + desktop)
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${username} on The Secret`,
          text: 'Check out this anonymous profile on The Secret 🔒',
          url: profileUrl,
        });
      } catch {
        // User cancelled share — do nothing
      }
    } else {
      handleCopy(); // Fallback to copy
    }
  };

  // Download QR as PNG
  const handleDownload = () => {
    const canvas = document.getElementById('qr-share-canvas');
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${username}-profile-qr.png`;
    a.click();
    toast.success('QR code downloaded!');
  };

  // Close on backdrop click
  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      onClick={handleBackdrop}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '32px',
          maxWidth: 400,
          width: '100%',
          boxShadow: 'var(--shadow-lg)',
          animation: 'fadeIn 200ms ease-out',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Share Profile</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Share <strong style={{ color: 'var(--purple)' }}>@{username}</strong>'s profile
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--surface-light)', border: 'none', borderRadius: '50%',
              width: 32, height: 32, cursor: 'pointer', color: 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
            }}
          >
            ✕
          </button>
        </div>

        {/* QR Code */}
        <div style={{
          display: 'flex', justifyContent: 'center', marginBottom: 24,
          padding: '20px',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
        }}>
          {loading ? (
            <div style={{ width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              Generating QR...
            </div>
          ) : (
            <QRCodeCanvas
              id="qr-share-canvas"
              value={profileUrl}
              size={200}
              bgColor="#0d0d14"        /* app dark background */
              fgColor="#a78bfa"        /* app purple accent */
              level="H"               /* High error correction for logo */
              imageSettings={{
                src: `${window.location.origin}/logo192.png`,
                height: 36,
                width: 36,
                excavate: true,
              }}
            />
          )}
        </div>

        {/* Profile URL display */}
        <div style={{
          background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)',
          padding: '10px 14px', marginBottom: 20,
          fontSize: '0.78rem', color: 'var(--text-muted)',
          wordBreak: 'break-all', border: '1px solid var(--border)',
        }}>
          🔗 {profileUrl || 'Loading...'}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={handleCopy}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px', borderRadius: 'var(--radius-md)',
              background: copied ? 'var(--success)' : 'var(--purple)',
              color: 'white', border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: '0.9rem',
              transition: 'all 200ms ease',
            }}
          >
            {copied ? '✓ Copied!' : '📋 Copy Link'}
          </button>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleShare}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '12px', borderRadius: 'var(--radius-md)',
                background: 'var(--surface-light)', color: 'var(--text-primary)',
                border: '1px solid var(--border)', cursor: 'pointer',
                fontWeight: 600, fontSize: '0.85rem',
              }}
            >
              📤 Share
            </button>
            <button
              onClick={handleDownload}
              disabled={loading}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '12px', borderRadius: 'var(--radius-md)',
                background: 'var(--surface-light)', color: 'var(--text-primary)',
                border: '1px solid var(--border)', cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 600, fontSize: '0.85rem', opacity: loading ? 0.5 : 1,
              }}
            >
              ⬇️ Download QR
            </button>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 16 }}>
          🔒 Only your public profile info is shared. No sensitive data is exposed.
        </p>
      </div>
    </div>
  );
}
