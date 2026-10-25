import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { useNotification } from '../contexts/NotificationContext';
import { User, Phone, MapPin, Building, Briefcase, Calendar, Shield, Save } from 'lucide-react';

export default function ProfilePage() {
  const { user } = useAuth();
  const { showToast } = useNotification();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    phone: '',
    address: '',
  });

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    if (!user?.employee?.id) {
      setLoading(false);
      return;
    }

    try {
      const res = await api.getEmployeeById(user.employee.id);
      setEmployee(res.employee);
      setForm({
        phone: res.employee.phone || '',
        address: res.employee.address || '',
      });
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.updateSelfProfile({
        phone: form.phone,
        address: form.address,
      });
      showToast('Personal contact details updated successfully', 'success');
      setEmployee(res.employee);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="page-wrapper" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading employee profile...
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="page-wrapper">
        <div className="glass-panel" style={{ padding: 30, textAlign: 'center' }}>
          <h3>Profile Not Attached</h3>
          <p style={{ color: 'var(--text-muted)' }}>This account does not have a linked employee record.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper animate-fade-in" style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>My Employee Profile</h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 4 }}>
          Personal workplace information. Per company policy, employees may self-service update phone and address.
        </p>
      </div>

      <div className="glass-panel" style={{ padding: 28, marginBottom: 24 }}>
        {/* Profile Header Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border-color)' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              fontWeight: 800,
            }}
          >
            {employee.firstName[0]}
          </div>

          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0 }}>
              {employee.firstName} {employee.lastName}
            </h2>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>
              <code>{employee.employeeCode}</code> • {employee.email}
            </div>
            <div style={{ marginTop: 6 }}>
              <span className={`badge badge-${employee.status.toLowerCase()}`}>
                {employee.status}
              </span>
            </div>
          </div>
        </div>

        {/* Read-Only Organizational Metadata */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div style={{ background: 'var(--bg-elevated)', padding: 14, borderRadius: 12 }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Building size={13} /> Department
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: 4 }}>
              {employee.department?.name || 'N/A'}
            </div>
          </div>

          <div style={{ background: 'var(--bg-elevated)', padding: 14, borderRadius: 12 }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Briefcase size={13} /> Designation
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: 4 }}>
              {employee.designation?.title || 'N/A'}
            </div>
          </div>

          <div style={{ background: 'var(--bg-elevated)', padding: 14, borderRadius: 12 }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={13} /> Joining Date
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: 4 }}>
              {new Date(employee.joiningDate).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Editable Self-Service Fields */}
        <form onSubmit={handleSave}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 14 }}>
            Contact & Address Self-Service
          </h3>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Phone size={14} /> Personal Phone Number
            </label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+1 (555) 000-0000"
            />
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <MapPin size={14} /> Residential / Mailing Address
            </label>
            <textarea
              rows={3}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Enter your street, city, state, and zip code..."
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary"
            style={{ marginTop: 8 }}
          >
            <Save size={16} /> {saving ? 'Saving...' : 'Update Contact Information'}
          </button>
        </form>
      </div>
    </div>
  );
}
