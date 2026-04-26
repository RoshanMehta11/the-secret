import React, { useState } from 'react';
import { chatroomAPI } from '../../utils/api';

export default function CreateRoomModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('public');
  const [maxParticipants, setMaxParticipants] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdRoom, setCreatedRoom] = useState(null);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setError('Room name is required');
    setLoading(true);
    setError('');

    try {
      const { data } = await chatroomAPI.create({ name: name.trim(), type, maxParticipants });
      if (data.success) {
        setCreatedRoom(data.room);
        if (type === 'public') {
          // Auto-join public rooms immediately
          onCreated(data.room);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (createdRoom?.code) {
      navigator.clipboard.writeText(createdRoom.code).catch(() => {});
    }
  };

  // After private room created — show code
  if (createdRoom && createdRoom.type === 'private') {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h3>🔒 Private Room Created</h3>
          <p className="modal-subtitle">Share this code with friends to join</p>

          <div className="code-display">
            <div className="code-display-value">{createdRoom.code}</div>
            <div className="code-display-label">Room Code</div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={handleCopyCode}>
              📋 Copy Code
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => onCreated(createdRoom)}>
              Enter Room →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>✨ Create Chatroom</h3>
        <p className="modal-subtitle">Rooms expire automatically after 24 hours</p>

        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label className="form-label">Room Name</label>
            <input
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Give your room a name..."
              maxLength={50}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Type</label>
            <div className="type-toggle">
              <button type="button" className={type === 'public' ? 'active' : ''} onClick={() => setType('public')}>
                🌐 Public
              </button>
              <button type="button" className={type === 'private' ? 'active' : ''} onClick={() => setType('private')}>
                🔒 Private
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Max Participants: {maxParticipants}</label>
            <input
              type="range"
              min={2}
              max={50}
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--purple)' }}
            />
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading || !name.trim()}>
              {loading ? 'Creating...' : 'Create Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
