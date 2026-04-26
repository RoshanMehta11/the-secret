import React, { useState, useEffect, useCallback } from 'react';
import { chatroomAPI } from '../../utils/api';

function formatTimeRemaining(expiresAt) {
  const diff = new Date(expiresAt) - Date.now();
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

export default function PublicRoomList({ onJoinRoom }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchRooms = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const { data } = await chatroomAPI.getPublic({ page: p, limit: 12 });
      if (data.success) {
        setRooms(data.rooms || []);
        setTotalPages(data.totalPages || 1);
        setPage(data.page || 1);
      }
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms(1);
    // Auto-refresh every 15 seconds
    const interval = setInterval(() => fetchRooms(page), 15000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line

  if (loading && rooms.length === 0) {
    return <div className="spinner"><div className="spin" /></div>;
  }

  if (rooms.length === 0) {
    return (
      <div className="rooms-empty">
        <div className="rooms-empty-icon">🏠</div>
        <p>No public rooms available right now.</p>
        <p style={{ fontSize: '0.8rem' }}>Be the first to create one!</p>
      </div>
    );
  }

  return (
    <div>
      <div className="room-grid">
        {rooms.map((room) => {
          const isFull = room.participantCount >= room.maxParticipants;
          return (
            <div
              key={room.roomId}
              className="room-card"
              onClick={() => !isFull && onJoinRoom(room)}
              style={isFull ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
            >
              <div className="room-card-name">{room.name}</div>
              <div className="room-card-meta">
                <span>⏱ {formatTimeRemaining(room.expiresAt)}</span>
                <span>👥 {room.maxParticipants} max</span>
              </div>
              <div className="room-card-footer">
                <span className={`participant-badge ${isFull ? 'full' : ''}`}>
                  {isFull ? '🔴' : '🟢'} {room.participantCount || 0} online
                </span>
                <button
                  className={`btn btn-sm ${isFull ? 'btn-ghost' : 'btn-primary'}`}
                  disabled={isFull}
                  onClick={(e) => { e.stopPropagation(); if (!isFull) onJoinRoom(room); }}
                >
                  {isFull ? 'Full' : 'Join'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="pagination" style={{ marginTop: 24 }}>
          <button
            className="page-btn"
            disabled={page <= 1}
            onClick={() => fetchRooms(page - 1)}
          >
            ←
          </button>
          <span className="page-btn active">{page}</span>
          <button
            className="page-btn"
            disabled={page >= totalPages}
            onClick={() => fetchRooms(page + 1)}
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
