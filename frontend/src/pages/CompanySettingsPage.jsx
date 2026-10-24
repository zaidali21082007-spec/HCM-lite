import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useNotification } from '../contexts/NotificationContext';
import Modal from '../components/Modal';
import {
  Settings,
  Building,
  Briefcase,
  Calendar,
  ShieldCheck,
  UserCheck,
  Plus,
  Trash2,
  Lock,
  Save,
  CheckCircle,
  ToggleLeft,
  ToggleRight,
  Clock,
} from 'lucide-react';

export default function CompanySettingsPage() {
  const { showToast } = useNotification();
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(true);

  // General Settings
  const [settings, setSettings] = useState({
    companyName: '',
    officeStartTime: '09:00',
    officeEndTime: '18:00',
    graceMinutes: 15,
    halfDayHours: 5.0,
    weekendDays: 'Saturday,Sunday',
    officeLatitude: '',
    officeLongitude: '',
    officeRadiusMeters: '',
  });

  // Masters
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [hrUsers, setHrUsers] = useState([]);

  // Modals state
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [deptForm, setDeptForm] = useState({ name: '', code: '', description: '' });

  const [showDesModal, setShowDesModal] = useState(false);
  const [desForm, setDesForm] = useState({ title: '', description: '' });

  const [showLeaveTypeModal, setShowLeaveTypeModal] = useState(false);
  const [leaveTypeForm, setLeaveTypeForm] = useState({
    name: '',
    code: '',
    annualQuota: 12,
    isUnpaid: false,
    description: '',
  });

  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [holidayForm, setHolidayForm] = useState({
    name: '',
    date: new Date().toISOString().substring(0, 10),
    description: '',
  });

  const [showHrUserModal, setShowHrUserModal] = useState(false);
  const [hrUserForm, setHrUserForm] = useState({ email: '', password: 'Password123!' });

  const [resetPasswordModal, setResetPasswordModal] = useState(null);
  const [newResetPassword, setNewResetPassword] = useState('NewPass123!');

  useEffect(() => {
    loadAllSettings();
  }, []);

  async function loadAllSettings() {
    setLoading(true);
    try {
      const [setRes, deptRes, desRes, ltRes, holRes, hrRes] = await Promise.all([
        api.getCompanySettings(),
        api.getDepartments(),
        api.getDesignations(),
        api.getLeaveTypes(),
        api.getHolidays(),
        api.getHrUsers(),
      ]);

      if (setRes.settings) setSettings(setRes.settings);
      setDepartments(deptRes.departments || []);
      setDesignations(desRes.designations || []);
      setLeaveTypes(ltRes.leaveTypes || []);
      setHolidays(holRes.holidays || []);
      setHrUsers(hrRes.users || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  // Save Settings
  async function handleSaveSettings(e) {
    e.preventDefault();
    try {
      await api.updateCompanySettings({
        companyName: settings.companyName,
        officeStartTime: settings.officeStartTime,
        officeEndTime: settings.officeEndTime,
        graceMinutes: Number(settings.graceMinutes),
        halfDayHours: Number(settings.halfDayHours),
        weekendDays: settings.weekendDays,
        officeLatitude: settings.officeLatitude !== '' && settings.officeLatitude != null && !isNaN(Number(settings.officeLatitude)) ? Number(settings.officeLatitude) : null,
        officeLongitude: settings.officeLongitude !== '' && settings.officeLongitude != null && !isNaN(Number(settings.officeLongitude)) ? Number(settings.officeLongitude) : null,
        officeRadiusMeters: settings.officeRadiusMeters !== '' && settings.officeRadiusMeters != null && !isNaN(Number(settings.officeRadiusMeters)) ? Number(settings.officeRadiusMeters) : null,
      });
      showToast('Company settings successfully updated', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // Department Handlers
  async function handleCreateDept(e) {
    e.preventDefault();
    try {
      await api.createDepartment(deptForm);
      showToast('Department created', 'success');
      setShowDeptModal(false);
      setDeptForm({ name: '', code: '', description: '' });
      loadAllSettings();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleDeleteDept(id) {
    if (!confirm('Are you sure you want to delete this department?')) return;
    try {
      await api.deleteDepartment(id);
      showToast('Department deleted', 'success');
      loadAllSettings();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // Designation Handlers
  async function handleCreateDesignation(e) {
    e.preventDefault();
    try {
      await api.createDesignation(desForm);
      showToast('Designation created', 'success');
      setShowDesModal(false);
      setDesForm({ title: '', description: '' });
      loadAllSettings();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleDeleteDesignation(id) {
    if (!confirm('Are you sure you want to delete this designation?')) return;
    try {
      await api.deleteDesignation(id);
      showToast('Designation deleted', 'success');
      loadAllSettings();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // Leave Type Handlers
  async function handleCreateLeaveType(e) {
    e.preventDefault();
    try {
      await api.createLeaveType({
        ...leaveTypeForm,
        annualQuota: Number(leaveTypeForm.annualQuota),
      });
      showToast('Leave type created', 'success');
      setShowLeaveTypeModal(false);
      setLeaveTypeForm({ name: '', code: '', annualQuota: 12, isUnpaid: false, description: '' });
      loadAllSettings();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // Holiday Handlers
  async function handleCreateHoliday(e) {
    e.preventDefault();
    try {
      await api.createHoliday(holidayForm);
      showToast('Holiday created', 'success');
      setShowHolidayModal(false);
      setHolidayForm({ name: '', date: new Date().toISOString().substring(0, 10), description: '' });
      loadAllSettings();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleDeleteHoliday(id) {
    if (!confirm('Are you sure you want to delete this holiday?')) return;
    try {
      await api.deleteHoliday(id);
      showToast('Holiday deleted', 'success');
      loadAllSettings();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // HR User Handlers
  async function handleCreateHrUser(e) {
    e.preventDefault();
    try {
      await api.createHrUser(hrUserForm);
      showToast('HR User account created with temporary credentials', 'success');
      setShowHrUserModal(false);
      setHrUserForm({ email: '', password: 'Password123!' });
      loadAllSettings();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleToggleHrStatus(userId, currentStatus) {
    try {
      await api.toggleHrUserStatus(userId, !currentStatus);
      showToast(`User ${!currentStatus ? 'activated' : 'deactivated'}`, 'success');
      loadAllSettings();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleResetHrPassword(e) {
    e.preventDefault();
    if (!resetPasswordModal) return;
    try {
      await api.resetHrUserPassword(resetPasswordModal.id, newResetPassword);
      showToast('Password reset successfully! User must change on next login.', 'success');
      setResetPasswordModal(null);
      loadAllSettings();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  return (
    <div className="page-wrapper animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>Company Master Settings</h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 4 }}>
          Office hours, late grace threshold, GPS geofencing, organization units, quotas, and HR logins.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div
        className="glass-panel"
        style={{
          padding: 6,
          display: 'flex',
          gap: 6,
          marginBottom: 24,
          overflowX: 'auto',
        }}
      >
        {[
          { id: 'general', label: 'Office Hours & Geofence', icon: Clock },
          { id: 'departments', label: 'Departments', icon: Building },
          { id: 'designations', label: 'Designations', icon: Briefcase },
          { id: 'leavetypes', label: 'Leave Types & Quotas', icon: Calendar },
          { id: 'holidays', label: 'Holidays Calendar', icon: Calendar },
          { id: 'hrlogins', label: 'HR User Management', icon: UserCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: 10,
                fontSize: '0.825rem',
                fontWeight: 600,
                background: isActive ? 'var(--primary)' : 'transparent',
                color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'var(--transition)',
              }}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: General Settings */}
      {activeTab === 'general' && (
        <form onSubmit={handleSaveSettings} className="glass-panel animate-fade-in" style={{ padding: 24 }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 18 }}>
            Office Hours & Geofence Coordinates
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <div className="form-group">
              <label>Company Legal Name</label>
              <input
                type="text"
                value={settings.companyName}
                onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Weekend Days (Comma-separated)</label>
              <input
                type="text"
                value={settings.weekendDays}
                onChange={(e) => setSettings({ ...settings, weekendDays: e.target.value })}
                placeholder="Saturday,Sunday"
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginTop: 8 }}>
            <div className="form-group">
              <label>Office Start Time</label>
              <input
                type="text"
                value={settings.officeStartTime}
                onChange={(e) => setSettings({ ...settings, officeStartTime: e.target.value })}
                placeholder="09:00"
                required
              />
            </div>

            <div className="form-group">
              <label>Office End Time</label>
              <input
                type="text"
                value={settings.officeEndTime}
                onChange={(e) => setSettings({ ...settings, officeEndTime: e.target.value })}
                placeholder="18:00"
                required
              />
            </div>

            <div className="form-group">
              <label>Grace Time (Minutes)</label>
              <input
                type="number"
                min="0"
                value={settings.graceMinutes}
                onChange={(e) => setSettings({ ...settings, graceMinutes: Number(e.target.value) })}
                required
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Late after {settings.officeStartTime} + {settings.graceMinutes}m (default 09:15)
              </span>
            </div>

            <div className="form-group">
              <label>Half-Day Threshold (Hours)</label>
              <input
                type="number"
                step="0.5"
                min="1"
                value={settings.halfDayHours}
                onChange={(e) => setSettings({ ...settings, halfDayHours: Number(e.target.value) })}
                required
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Under {settings.halfDayHours}h shift stamped HALF DAY
              </span>
            </div>
          </div>

          <div style={{ marginTop: 16, borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 12 }}>
              Office Geofence Location (GPS Verification)
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <div className="form-group">
                <label>Office Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={settings.officeLatitude ?? ''}
                  onChange={(e) => setSettings({ ...settings, officeLatitude: e.target.value === '' ? '' : Number(e.target.value) })}
                  placeholder="Leave empty to skip geofence"
                />
              </div>

              <div className="form-group">
                <label>Office Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={settings.officeLongitude ?? ''}
                  onChange={(e) => setSettings({ ...settings, officeLongitude: e.target.value === '' ? '' : Number(e.target.value) })}
                  placeholder="Leave empty to skip geofence"
                />
              </div>

              <div className="form-group">
                <label>Allowed Radius (Meters)</label>
                <input
                  type="number"
                  min="1"
                  value={settings.officeRadiusMeters ?? ''}
                  onChange={(e) => setSettings({ ...settings, officeRadiusMeters: e.target.value === '' ? '' : Number(e.target.value) })}
                  placeholder="e.g. 500 (optional)"
                />
              </div>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ marginTop: 18 }}>
            <Save size={16} /> Save Company Settings
          </button>
        </form>
      )}

      {/* Tab 2: Departments */}
      {activeTab === 'departments' && (
        <div className="glass-panel animate-fade-in" style={{ padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Company Departments</h3>
            <button onClick={() => setShowDeptModal(true)} className="btn btn-primary btn-sm">
              <Plus size={14} /> Add Department
            </button>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Department Name</th>
                  <th>Code</th>
                  <th>Description</th>
                  <th>Assigned Staff</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((d) => (
                  <tr key={d.id}>
                    <td><strong>{d.name}</strong></td>
                    <td><code>{d.code}</code></td>
                    <td>{d.description || '—'}</td>
                    <td>{d._count?.employees || 0}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => handleDeleteDept(d.id)}
                        className="btn btn-danger btn-sm"
                        disabled={d._count?.employees > 0}
                        title={d._count?.employees > 0 ? 'Cannot delete department with active employees' : 'Delete'}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Designations */}
      {activeTab === 'designations' && (
        <div className="glass-panel animate-fade-in" style={{ padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Company Designations & Titles</h3>
            <button onClick={() => setShowDesModal(true)} className="btn btn-primary btn-sm">
              <Plus size={14} /> Add Designation
            </button>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Designation Title</th>
                  <th>Description</th>
                  <th>Assigned Staff</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {designations.map((d) => (
                  <tr key={d.id}>
                    <td><strong>{d.title}</strong></td>
                    <td>{d.description || '—'}</td>
                    <td>{d._count?.employees || 0}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => handleDeleteDesignation(d.id)}
                        className="btn btn-danger btn-sm"
                        disabled={d._count?.employees > 0}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Leave Types & Quotas */}
      {activeTab === 'leavetypes' && (
        <div className="glass-panel animate-fade-in" style={{ padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Leave Categories & Annual Quotas</h3>
            <button onClick={() => setShowLeaveTypeModal(true)} className="btn btn-primary btn-sm">
              <Plus size={14} /> Add Leave Type
            </button>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Category Name</th>
                  <th>Code</th>
                  <th>Annual Quota</th>
                  <th>Type</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {leaveTypes.map((lt) => (
                  <tr key={lt.id}>
                    <td><strong>{lt.name}</strong></td>
                    <td><code>{lt.code}</code></td>
                    <td><strong>{lt.isUnpaid ? 'Unlimited' : `${lt.annualQuota} days`}</strong></td>
                    <td>
                      <span className={`badge ${lt.isUnpaid ? 'badge-draft' : 'badge-present'}`}>
                        {lt.isUnpaid ? 'Unpaid' : 'Paid Quota'}
                      </span>
                    </td>
                    <td>{lt.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Holidays */}
      {activeTab === 'holidays' && (
        <div className="glass-panel animate-fade-in" style={{ padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Company Public Holidays</h3>
            <button onClick={() => setShowHolidayModal(true)} className="btn btn-primary btn-sm">
              <Plus size={14} /> Add Holiday
            </button>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Holiday Name</th>
                  <th>Date</th>
                  <th>Description</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {holidays.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>
                      No company holidays configured yet.
                    </td>
                  </tr>
                ) : (
                  holidays.map((h) => (
                    <tr key={h.id}>
                      <td><strong>{h.name}</strong></td>
                      <td><code>{new Date(h.date).toISOString().substring(0, 10)}</code></td>
                      <td>{h.description || '—'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button onClick={() => handleDeleteHoliday(h.id)} className="btn btn-danger btn-sm">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 6: HR User Management */}
      {activeTab === 'hrlogins' && (
        <div className="glass-panel animate-fade-in" style={{ padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>HR Operator Logins</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                Grant HR operator access to register employees, approve leaves, and draft payroll.
              </p>
            </div>
            <button onClick={() => setShowHrUserModal(true)} className="btn btn-primary btn-sm">
              <Plus size={14} /> Create HR Login
            </button>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>HR Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Temporary Password Flag</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {hrUsers.map((u) => (
                  <tr key={u.id}>
                    <td><strong>{u.email}</strong></td>
                    <td><span className="badge badge-role-hr">{u.role}</span></td>
                    <td>
                      <span className={`badge ${u.isActive ? 'badge-active' : 'badge-inactive'}`}>
                        {u.isActive ? 'ACTIVE' : 'DEACTIVATED'}
                      </span>
                    </td>
                    <td>
                      {u.isTemporaryPassword ? (
                        <span style={{ color: 'var(--warning)', fontSize: '0.75rem', fontWeight: 600 }}>
                          Must reset on first login
                        </span>
                      ) : (
                        <span style={{ color: 'var(--success)', fontSize: '0.75rem' }}>Permanent password set</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleToggleHrStatus(u.id, u.isActive)}
                          className="btn btn-secondary btn-sm"
                        >
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => setResetPasswordModal(u)}
                          className="btn btn-secondary btn-sm"
                        >
                          <Lock size={12} /> Reset Pass
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Department Modal */}
      <Modal isOpen={showDeptModal} onClose={() => setShowDeptModal(false)} title="Add Department">
        <form onSubmit={handleCreateDept} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Department Name *</label>
            <input
              type="text"
              placeholder="e.g. Legal & Compliance"
              value={deptForm.name}
              onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
              required
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Department Code *</label>
            <input
              type="text"
              placeholder="e.g. LEG"
              value={deptForm.code}
              onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })}
              required
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Description</label>
            <textarea
              rows={2}
              value={deptForm.description}
              onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ padding: 12, marginTop: 6 }}>
            Create Department
          </button>
        </form>
      </Modal>

      {/* Add Designation Modal */}
      <Modal isOpen={showDesModal} onClose={() => setShowDesModal(false)} title="Add Designation">
        <form onSubmit={handleCreateDesignation} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Designation Title *</label>
            <input
              type="text"
              placeholder="e.g. Quality Assurance Lead"
              value={desForm.title}
              onChange={(e) => setDesForm({ ...desForm, title: e.target.value })}
              required
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Description</label>
            <textarea
              rows={2}
              value={desForm.description}
              onChange={(e) => setDesForm({ ...desForm, description: e.target.value })}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ padding: 12, marginTop: 6 }}>
            Create Designation
          </button>
        </form>
      </Modal>

      {/* Add Leave Type Modal */}
      <Modal isOpen={showLeaveTypeModal} onClose={() => setShowLeaveTypeModal(false)} title="Add Leave Category">
        <form onSubmit={handleCreateLeaveType} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Category Name *</label>
            <input
              type="text"
              placeholder="e.g. Maternity / Paternity Leave"
              value={leaveTypeForm.name}
              onChange={(e) => setLeaveTypeForm({ ...leaveTypeForm, name: e.target.value })}
              required
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Code *</label>
              <input
                type="text"
                placeholder="e.g. MATERNITY"
                value={leaveTypeForm.code}
                onChange={(e) => setLeaveTypeForm({ ...leaveTypeForm, code: e.target.value })}
                required
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Annual Quota (Days) *</label>
              <input
                type="number"
                min="0"
                value={leaveTypeForm.annualQuota}
                onChange={(e) => setLeaveTypeForm({ ...leaveTypeForm, annualQuota: Number(e.target.value) })}
                required
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ padding: 12, marginTop: 6 }}>
            Save Leave Type
          </button>
        </form>
      </Modal>

      {/* Add Holiday Modal */}
      <Modal isOpen={showHolidayModal} onClose={() => setShowHolidayModal(false)} title="Add Public Holiday">
        <form onSubmit={handleCreateHoliday} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Holiday Name *</label>
            <input
              type="text"
              placeholder="e.g. New Year's Day"
              value={holidayForm.name}
              onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
              required
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Date *</label>
            <input
              type="date"
              value={holidayForm.date}
              onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ padding: 12, marginTop: 6 }}>
            Add Holiday
          </button>
        </form>
      </Modal>

      {/* Create HR User Modal */}
      <Modal isOpen={showHrUserModal} onClose={() => setShowHrUserModal(false)} title="Create HR Operator Login">
        <form onSubmit={handleCreateHrUser} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Email *</label>
            <input
              type="email"
              placeholder="hr.officer@company.com"
              value={hrUserForm.email}
              onChange={(e) => setHrUserForm({ ...hrUserForm, email: e.target.value })}
              required
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Default Temporary Password *</label>
            <input
              type="text"
              value={hrUserForm.password}
              onChange={(e) => setHrUserForm({ ...hrUserForm, password: e.target.value })}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ padding: 12, marginTop: 6 }}>
            Create HR Login
          </button>
        </form>
      </Modal>

      {/* Reset HR Password Modal */}
      <Modal
        isOpen={!!resetPasswordModal}
        onClose={() => setResetPasswordModal(null)}
        title={`Reset Password for ${resetPasswordModal?.email}`}
      >
        <form onSubmit={handleResetHrPassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>New Temporary Password (Min 8 chars)</label>
            <input
              type="text"
              value={newResetPassword}
              onChange={(e) => setNewResetPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ padding: 12 }}>
            Confirm Reset Password
          </button>
        </form>
      </Modal>
    </div>
  );
}
