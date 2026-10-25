import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNotification } from '../contexts/NotificationContext';
import {
  Bell,
  Sun,
  Moon,
  Sparkles,
  LogOut,
  User as UserIcon,
  CheckCircle,
  Menu,
} from 'lucide-react';

export default function Navbar({ onToggleSidebar, onOpenAiModal }) {
  const { user, logout, companyName } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotification();
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header
      style={{
        height: 64,
        borderBottom: '1px solid var(--border-color)',
        background: 'var(--bg-card)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button
          onClick={onToggleSidebar}
          className="btn btn-secondary btn-sm"
          style={{ padding: '6px 10px', display: 'flex' }}
          aria-label="Toggle menu"
        >
          <Menu size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '1rem',
            }}
          >
            H
          </div>
          <div>
            <h1 style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
              {companyName || 'HCM Lite'}
            </h1>
          </div>
        </div>
      </div>

      {/* Right controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Live Clock Pill */}
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            padding: '5px 12px',
            background: 'var(--bg-elevated)',
            borderRadius: 20,
            border: '1px solid var(--border-color)',
            color: 'var(--text-secondary)',
            display: 'none',
          }}
          className="desktop-clock"
        >
          {timeStr}
        </div>

        {/* AI Assistant Quick Trigger */}
        <button
          onClick={onOpenAiModal}
          className="btn"
          style={{
            background: 'var(--primary-light)',
            color: 'var(--primary)',
            border: '1px solid var(--border-color)',
            padding: '6px 14px',
            borderRadius: 20,
            fontSize: '0.825rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Sparkles size={16} />
          <span>AI Assistant</span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="btn btn-secondary btn-sm"
          style={{ borderRadius: '50%', width: 36, height: 36, padding: 0 }}
          title="Toggle light/dark theme"
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        {/* Notification Bell */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowNotifMenu(!showNotifMenu)}
            className="btn btn-secondary btn-sm"
            style={{ borderRadius: '50%', width: 36, height: 36, padding: 0, position: 'relative' }}
          >
            <Bell size={17} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: 'var(--danger)',
                  color: '#FFFFFF',
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifMenu && (
            <div
              className="glass-panel animate-fade-in"
              style={{
                position: 'absolute',
                top: 46,
                right: 0,
                width: 320,
                maxHeight: 400,
                overflowY: 'auto',
                padding: 12,
                zIndex: 100,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.825rem' }}>
                  No notifications yet
                </div>
              ) : (
                notifications.slice(0, 10).map((n) => (
                  <div
                    key={n.id}
                    onClick={() => markAsRead(n.id)}
                    style={{
                      padding: 10,
                      borderRadius: 8,
                      marginBottom: 6,
                      background: n.isRead ? 'transparent' : 'var(--bg-elevated)',
                      cursor: 'pointer',
                      borderLeft: n.isRead ? '3px solid transparent' : '3px solid var(--primary)',
                      transition: 'background 0.2s',
                    }}
                  >
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{n.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>{n.message}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* User Profile Menu */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            style={{
              background: 'none',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.85rem',
              }}
            >
              {user?.employee?.firstName ? user.employee.firstName[0] : user?.email[0].toUpperCase()}
            </div>
            <div style={{ textAlign: 'left', display: 'none' }} className="desktop-user-info">
              <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                {user?.employee ? `${user.employee.firstName} ${user.employee.lastName}` : user?.email}
              </div>
              <span className={`badge badge-role-${user?.role?.toLowerCase()}`} style={{ fontSize: '0.65rem' }}>
                {user?.role}
              </span>
            </div>
          </button>

          {showUserMenu && (
            <div
              className="glass-panel animate-fade-in"
              style={{
                position: 'absolute',
                top: 46,
                right: 0,
                width: 220,
                padding: 10,
                zIndex: 100,
              }}
            >
              <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-color)', marginBottom: 6 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                  {user?.employee ? `${user.employee.firstName} ${user.employee.lastName}` : user?.email}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user?.email}</div>
                <div style={{ marginTop: 4 }}>
                  <span className={`badge badge-role-${user?.role?.toLowerCase()}`}>
                    {user?.role}
                  </span>
                </div>
              </div>

              {user?.isEmployee && (
                <a
                  href="/profile"
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 4 }}
                >
                  <UserIcon size={14} /> My Profile
                </a>
              )}

              <a
                href="/change-password"
                className="btn btn-secondary btn-sm"
                style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 6 }}
              >
                Change Password
              </a>

              <button
                onClick={logout}
                className="btn btn-danger btn-sm"
                style={{ width: '100%', justifyContent: 'flex-start' }}
              >
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .desktop-clock { display: block !important; }
          .desktop-user-info { display: block !important; }
        }
      `}</style>
    </header>
  );
}
