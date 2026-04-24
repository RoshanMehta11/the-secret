import React, { useEffect, useState } from 'react';
import { useSocketContext } from '../../context/SocketContext';
import '../../styles/notifications.css';

export default function NotifToast() {
  const { notifications, dismissToast } = useSocketContext();
  const [visible, setVisible] = useState([]);

  useEffect(() => {
    if (notifications.length === 0) return;
    const latest = notifications[0];
    if (!latest) return;

    // Add to visible
    const id = Date.now();
    setVisible((prev) => [{ ...latest, _toastId: id, entering: true }, ...prev.slice(0, 2)]);

    // Auto-dismiss after 4s
    const timer = setTimeout(() => {
      setVisible((prev) =>
        prev.map((t) => (t._toastId === id ? { ...t, exiting: true } : t))
      );
      setTimeout(() => {
        setVisible((prev) => prev.filter((t) => t._toastId !== id));
        dismissToast(0);
      }, 300);
    }, 4000);

    return () => clearTimeout(timer);
  }, [notifications, dismissToast]);

  if (visible.length === 0) return null;

  return (
    <div className="toast-container">
      {visible.map((toast) => (
        <div
          key={toast._toastId}
          className={`toast-notif ${toast.entering ? 'entering' : ''} ${toast.exiting ? 'exiting' : ''}`}
          onClick={() => {
            setVisible((prev) => prev.filter((t) => t._toastId !== toast._toastId));
          }}
        >
          <span style={{ fontSize: '1.2rem' }}>🔔</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{toast.title || 'New notification'}</div>
            {toast.body && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>{toast.body}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
