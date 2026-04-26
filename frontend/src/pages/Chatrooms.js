import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatroom } from '../context/ChatroomContext';
import CreateRoomModal from '../components/chatrooms/CreateRoomModal';
import JoinRoomModal from '../components/chatrooms/JoinRoomModal';
import PublicRoomList from '../components/chatrooms/PublicRoomList';
import '../styles/chatrooms.css';

export default function Chatrooms() {
  const navigate = useNavigate();
  const { connectNamespace, joinRoom } = useChatroom();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  const handleEnterRoom = (room) => {
    connectNamespace();
    navigate(`/chatrooms/${room.roomId}`);
  };

  return (
    <div className="chatrooms-page">
      <div className="chatrooms-header">
        <h1>🏠 Chatrooms</h1>
        <div className="chatrooms-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => setShowJoin(true)}>
            🔑 Join Private
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
            ✨ Create Room
          </button>
        </div>
      </div>

      <h3 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16, fontWeight: 600 }}>
        PUBLIC ROOMS
      </h3>

      <PublicRoomList onJoinRoom={handleEnterRoom} />

      {showCreate && (
        <CreateRoomModal
          onClose={() => setShowCreate(false)}
          onCreated={(room) => { setShowCreate(false); handleEnterRoom(room); }}
        />
      )}

      {showJoin && (
        <JoinRoomModal
          onClose={() => setShowJoin(false)}
          onJoined={(room) => { setShowJoin(false); handleEnterRoom(room); }}
        />
      )}
    </div>
  );
}
