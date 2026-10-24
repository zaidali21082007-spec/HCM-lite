import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { api } from '../services/api';
import { KeyRound, ShieldAlert, ArrowRight } from 'lucide-react';

export default function ChangePasswordPage() {
  const { user, updateCurrentUser } = useAuth();
  const { showToast } = useNotification();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (newPassword.length < 8) {
      showToast('New password must be at least 8 characters long', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match', 'error');
      return;
    }

    setLoading(true);
    try {
      await api.changePassword({ currentPassword, newPassword });
      showToast('Password successfully changed!', 'success');
      updateCurrentUser({ isTemporaryPassword: false });
      window.location.href = '/dashboard';
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        padding: 20,
      }}
    >
      <div
        className="glass-panel animate-fade-in"
        style={{
          width: '100%',
          maxWidth: 440,
          padding: 32,
          borderRadius: 20,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #F59E0B, #D97706)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              marginBottom: 12,
            }}
          >
            <KeyRound size={24} />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>
            {user?.isTemporaryPassword ? 'Set New Permanent Password' : 'Change Password'}
          </h2>
          {user?.isTemporaryPassword && (
            <div
              style={{
                marginTop: 10,
                padding: '8px 12px',
                borderRadius: 8,
                background: 'var(--warning-light)',
                color: 'var(--warning)',
                fontSize: '0.78rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <ShieldAlert size={14} /> You logged in with a temporary password. You must change it before continuing.
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Current / Temporary Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label>New Permanent Password (Min 8 characters)</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label>Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ padding: '12px', marginTop: 8 }}
          >
            {loading ? 'Updating Password...' : 'Save Password & Continue'} <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
