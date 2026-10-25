import React, { useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Building2, Shield, Clock, MapPin, CheckCircle, ArrowRight } from 'lucide-react';

export default function SetupPage() {
  const { checkInitialState } = useAuth();
  const { showToast } = useNotification();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  const [formData, setFormData] = useState({
    companyName: '',
    adminEmail: '',
    adminPassword: '',
    confirmPassword: '',
    officeStartTime: '09:00',
    officeEndTime: '18:00',
    graceMinutes: 15,
    officeLatitude: '',
    officeLongitude: '',
    officeRadiusMeters: '',
  });

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? '' : Number(value)) : value,
    }));
  };

  async function handleFinishSetup(e) {
    e.preventDefault();
    if (formData.adminPassword.length < 8) {
      showToast('Admin password must be at least 8 characters long', 'error');
      return;
    }
    if (formData.adminPassword !== formData.confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        companyName: formData.companyName,
        adminEmail: formData.adminEmail,
        adminPassword: formData.adminPassword,
        officeStartTime: formData.officeStartTime,
        officeEndTime: formData.officeEndTime,
        graceMinutes: Number(formData.graceMinutes),
        officeLatitude: formData.officeLatitude !== '' && !isNaN(Number(formData.officeLatitude)) ? Number(formData.officeLatitude) : null,
        officeLongitude: formData.officeLongitude !== '' && !isNaN(Number(formData.officeLongitude)) ? Number(formData.officeLongitude) : null,
        officeRadiusMeters: formData.officeRadiusMeters !== '' && !isNaN(Number(formData.officeRadiusMeters)) ? Number(formData.officeRadiusMeters) : null,
      };

      const res = await api.performSetup(payload);
      localStorage.setItem('hcm_token', res.token);
      showToast('Initial setup completed successfully! Welcome to HCM Lite.', 'success');
      await checkInitialState();
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
          maxWidth: 640,
          padding: 36,
          borderRadius: 12,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Step Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 10,
              background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              marginBottom: 12,
            }}
          >
            <Building2 size={26} />
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>
            Welcome to HCM Lite
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 6 }}>
            First-time setup: Configure company policies and the master Admin account.
          </p>

          {/* Stepper Dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 18 }}>
            <div
              style={{
                width: 32,
                height: 6,
                borderRadius: 3,
                background: step >= 1 ? 'var(--primary)' : 'var(--border-color)',
                transition: 'var(--transition)',
              }}
            />
            <div
              style={{
                width: 32,
                height: 6,
                borderRadius: 3,
                background: step >= 2 ? 'var(--primary)' : 'var(--border-color)',
                transition: 'var(--transition)',
              }}
            />
          </div>
        </div>

        {step === 1 && (
          <div className="animate-fade-in">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Building2 size={18} color="var(--primary)" /> Company Profile & Hours
            </h3>

            <div className="form-group">
              <label>Company Legal Name</label>
              <input
                type="text"
                name="companyName"
                value={formData.companyName}
                onChange={handleChange}
                placeholder="e.g. Acme Corp Inc."
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label>Office Start Time</label>
                <input
                  type="text"
                  name="officeStartTime"
                  value={formData.officeStartTime}
                  onChange={handleChange}
                  placeholder="09:00"
                  required
                />
              </div>

              <div className="form-group">
                <label>Office End Time</label>
                <input
                  type="text"
                  name="officeEndTime"
                  value={formData.officeEndTime}
                  onChange={handleChange}
                  placeholder="18:00"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Grace Period (Minutes before marked Late)</label>
              <input
                type="number"
                name="graceMinutes"
                value={formData.graceMinutes}
                onChange={handleChange}
                min={0}
                max={120}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Rule: Check-ins after {formData.officeStartTime} + {formData.graceMinutes}m are stamped Late.
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!formData.companyName) {
                  showToast('Please enter company name', 'error');
                  return;
                }
                setStep(2);
              }}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 12, padding: '12px' }}
            >
              Continue to Admin Account <ArrowRight size={16} />
            </button>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleFinishSetup} className="animate-fade-in">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Shield size={18} color="var(--primary)" /> Master Admin Credentials
            </h3>

            <div className="form-group">
              <label>Admin Email Address</label>
              <input
                type="email"
                name="adminEmail"
                value={formData.adminEmail}
                onChange={handleChange}
                placeholder="admin@yourcompany.com"
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label>Master Password</label>
                <input
                  type="password"
                  name="adminPassword"
                  value={formData.adminPassword}
                  onChange={handleChange}
                  placeholder="Min 8 characters"
                  required
                />
              </div>

              <div className="form-group">
                <label>Confirm Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Repeat password"
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="btn btn-secondary"
                style={{ flex: 1, padding: '12px' }}
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{ flex: 2, padding: '12px' }}
              >
                {loading ? 'Initializing Setup...' : 'Complete Setup & Launch'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
