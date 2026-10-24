import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const showToast = (message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, duration);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  async function fetchNotifications() {
    try {
      const token = localStorage.getItem('hcm_token');
      if (!token) return;
      const res = await api.getMyNotifications();
      if (res.notifications) {
        setNotifications(res.notifications);
        setUnreadCount(res.notifications.filter((n) => !n.isRead).length);
      }
    } catch (err) {
      // ignore silent notification fetch errors
    }
  }

  async function markAsRead(id) {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error(err);
    }
  }

  async function markAllAsRead() {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // 30s poll for live updates
    return () => clearInterval(interval);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        toasts,
        notifications,
        unreadCount,
        showToast,
        removeToast,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
      }}
    >
      {children}
      {/* Toast Renderer */}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360 }}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="animate-fade-in"
            style={{
              padding: '12px 18px',
              borderRadius: 12,
              background: toast.type === 'error' ? '#EF4444' : toast.type === 'success' ? '#10B981' : '#4F46E5',
              color: '#FFFFFF',
              boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
              fontSize: '0.875rem',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <span>{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              style={{ background: 'transparent', border: 'none', color: '#FFFFFF', cursor: 'pointer', fontSize: 16 }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export const useNotification = () => useContext(NotificationContext);
