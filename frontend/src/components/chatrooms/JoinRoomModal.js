import React, { useState, useRef, useCallback } from 'react';
import { chatroomAPI } from '../../utils/api';

export default function JoinRoomModal({ onClose, onJoined }) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRefs = useRef([]);

  const handleChange = useCallback((index, value) => {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    setError('');

    // Auto-focus next
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }, []);

  const handleKeyDown = useCallback((index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, [digits]);

  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length > 0) {
      const newDigits = [...digits];
      for (let i = 0; i < pasted.length && i < 6; i++) {
        newDigits[i] = pasted[i];
      }
      setDigits(newDigits);
      const focusIndex = Math.min(pasted.length, 5);
      inputRefs.current[focusIndex]?.focus();
    }
  }, [digits]);

  const handleJoin = async () => {
    const code = digits.join('');
    if (code.length !== 6) return setError('Enter all 6 digits');

    setLoading(true);
    setError('');

    try {
      const { data } = await chatroomAPI.findByCode(code);
      if (data.success && data.room) {
        onJoined(data.room);
      } else {
        setError('Room not found or expired');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to find room';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const isFull = digits.every((d) => d !== '');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>🔑 Join Private Room</h3>
        <p className="modal-subtitle">Enter the 6-digit code shared by the room creator</p>

        <div className="code-input-group" onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => (inputRefs.current[i] = el)}
              className={`code-digit ${d ? 'filled' : ''}`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              autoFocus={i === 0}
            />
          ))}
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={handleJoin}
            disabled={loading || !isFull}
          >
            {loading ? 'Joining...' : 'Join Room'}
          </button>
        </div>
      </div>
    </div>
  );
}
