import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { useNotification } from '../contexts/NotificationContext';
import Modal from '../components/Modal';
import { Megaphone, Plus, Bell, Clock, User, AlertCircle } from 'lucide-react';

export default function AnnouncementsPage() {
  const { user, isAdmin, isHR } = useAuth();
  const { showToast } = useNotification();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  // Post Announcement Modal
  const [showPostModal, setShowPostModal] = useState(false);
  const [postLoading, setPostLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    content: '',
    priority: 'MEDIUM',
  });

  useEffect(() => {
    loadAnnouncements();
  }, []);

  async function loadAnnouncements() {
    setLoading(true);
    try {
      const res = await api.getAnnouncements();
      setAnnouncements(res.announcements || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateAnnouncement(e) {
    e.preventDefault();
    setPostLoading(true);
    try {
      await api.createAnnouncement(form);
      showToast('Announcement broadcasted successfully!', 'success');
      setShowPostModal(false);
      setForm({ title: '', content: '', priority: 'MEDIUM' });
      loadAnnouncements();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setPostLoading(false);
    }
  }

  return (
    <div className="page-wrapper animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Megaphone size={26} color="var(--primary)" /> Company Announcements & Bulletins
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            Official updates, policy notices, and company broadcasts from HR & Leadership.
          </p>
        </div>

        {(isAdmin || isHR) && (
          <button onClick={() => setShowPostModal(true)} className="btn btn-primary btn-sm">
            <Plus size={16} /> Broadcast Announcement
          </button>
        )}
      </div>

      {/* Announcements Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {loading ? (
          <div className="glass-panel" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading announcements feed...
          </div>
        ) : announcements.length === 0 ? (
          <div className="glass-panel" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            No announcements broadcasted yet.
          </div>
        ) : (
          announcements.map((a) => {
            const isUrgent = a.priority === 'URGENT' || a.priority === 'HIGH';
            return (
              <div
                key={a.id}
                className="glass-panel"
                style={{
                  padding: 22,
                  borderLeft: isUrgent ? '4px solid #EF4444' : '4px solid var(--primary)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                      {a.title}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <User size={13} /> {a.authorName} ({a.authorRole})
                      </span>
                      <span>•</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={13} /> {new Date(a.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <span
                    className="badge"
                    style={{
                      background:
                        a.priority === 'URGENT'
                          ? 'var(--danger-light)'
                          : a.priority === 'HIGH'
                          ? 'var(--warning-light)'
                          : 'var(--primary-light)',
                      color:
                        a.priority === 'URGENT'
                          ? 'var(--danger)'
                          : a.priority === 'HIGH'
                          ? 'var(--warning)'
                          : 'var(--primary)',
                    }}
                  >
                    {a.priority}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: '0.875rem',
                    color: 'var(--text-primary)',
                    lineHeight: 1.6,
                    marginTop: 14,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {a.content}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Broadcast Modal */}
      <Modal isOpen={showPostModal} onClose={() => setShowPostModal(false)} title="Broadcast Company Announcement">
        <form onSubmit={handleCreateAnnouncement} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Title *</label>
            <input
              type="text"
              placeholder="e.g. Annual Town Hall & Q4 Goals"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label>Priority</label>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            >
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="URGENT">URGENT</option>
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label>Message Content *</label>
            <textarea
              rows={5}
              placeholder="Type your official announcement here..."
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              required
            />
          </div>

          <button
            type="submit"
            disabled={postLoading}
            className="btn btn-primary"
            style={{ padding: 12, marginTop: 6 }}
          >
            {postLoading ? 'Broadcasting...' : 'Publish Announcement'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
