import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useNotification } from '../contexts/NotificationContext';
import Modal from '../components/Modal';
import {
  UserPlus,
  FileSpreadsheet,
  Download,
  Search,
  Filter,
  Edit2,
  CheckCircle,
  AlertTriangle,
  Upload,
} from 'lucide-react';

export default function EmployeesPage() {
  const { showToast } = useNotification();
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [loading, setLoading] = useState(true);

  // Register Modal state
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regSuccessCreds, setRegSuccessCreds] = useState(null);
  const [regErrors, setRegErrors] = useState([]);
  const [registerForm, setRegisterForm] = useState({
    employeeCode: '',
    firstName: '',
    lastName: '',
    email: '',
    departmentId: '',
    designationId: '',
    joiningDate: new Date().toISOString().substring(0, 10),
    basicSalary: 60000,
    phone: '',
    address: '',
    temporaryPassword: 'Welcome123!',
  });

  // Edit Modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
    departmentId: '',
    designationId: '',
    basicSalary: 0,
    status: 'ACTIVE',
    exitDate: '',
  });

  // CSV Import Modal state
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [dryRunResult, setDryRunResult] = useState(null);

  useEffect(() => {
    loadData();
  }, [search, selectedDept]);

  async function loadData() {
    setLoading(true);
    try {
      const [empRes, deptRes, desRes] = await Promise.all([
        api.getEmployees({ search, departmentId: selectedDept }),
        api.getDepartments(),
        api.getDesignations(),
      ]);
      setEmployees(empRes.employees || []);
      setDepartments(deptRes.departments || []);
      setDesignations(desRes.designations || []);

      if (!registerForm.departmentId && deptRes.departments?.length > 0) {
        setRegisterForm((prev) => ({
          ...prev,
          departmentId: deptRes.departments[0].id,
          designationId: desRes.designations?.[0]?.id || '',
        }));
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  // Handle Employee Registration
  async function handleRegister(e) {
    e.preventDefault();
    setRegLoading(true);
    setRegErrors([]);
    try {
      const payload = {
        ...registerForm,
        basicSalary: Number(registerForm.basicSalary),
      };
      const res = await api.registerEmployee(payload);
      showToast(`Employee ${payload.employeeCode} registered successfully!`, 'success');
      setRegSuccessCreds(res.temporaryCredentials);
      setRegErrors([]);
      loadData();
    } catch (err) {
      if (err.errors && Array.isArray(err.errors)) {
        setRegErrors(err.errors);
      } else {
        setRegErrors([{ field: 'form', message: err.message }]);
      }
      showToast(err.message, 'error');
    } finally {
      setRegLoading(false);
    }
  }

  // Open Edit Details
  function openEditModal(emp) {
    setEditingEmployee(emp);
    setEditForm({
      firstName: emp.firstName,
      lastName: emp.lastName,
      phone: emp.phone || '',
      address: emp.address || '',
      departmentId: emp.departmentId,
      designationId: emp.designationId,
      basicSalary: emp.basicSalary,
      status: emp.status,
      exitDate: emp.exitDate ? emp.exitDate.substring(0, 10) : '',
    });
    setShowEditModal(true);
  }

  // Handle Edit Details Submit
  async function handleEditSubmit(e) {
    e.preventDefault();
    setEditLoading(true);
    try {
      const payload = {
        ...editForm,
        basicSalary: Number(editForm.basicSalary),
        exitDate: editForm.exitDate || null,
      };
      await api.updateEmployeeDetails(editingEmployee.id, payload);
      showToast('Employee details updated successfully', 'success');
      setShowEditModal(false);
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setEditLoading(false);
    }
  }

  // Handle CSV Export
  async function handleExportCsv() {
    try {
      const blob = await api.exportCsvBlob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `employees_export_${new Date().toISOString().substring(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('CSV export downloaded', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // Parse CSV text into rows object
  function parseCsvString(csv) {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = lines[i].split(',').map((v) => v.trim().replace(/^["']|["']$/g, ''));
      const row = {};
      headers.forEach((h, index) => {
        row[h] = values[index] || '';
      });
      rows.push(row);
    }
    return rows;
  }

  // Dry run CSV
  async function handleDryRunCsv() {
    if (!csvText.trim()) {
      showToast('Please paste or upload CSV content', 'error');
      return;
    }
    setCsvLoading(true);
    try {
      const rows = parseCsvString(csvText);
      const res = await api.dryRunCsv(rows);
      setDryRunResult(res);
      if (res.errors.length === 0) {
        showToast(`Dry run successful: ${res.validCount} valid rows ready for import!`, 'success');
      } else {
        showToast(`Dry run found ${res.errors.length} validation errors.`, 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setCsvLoading(false);
    }
  }

  // Commit CSV
  async function handleCommitCsv() {
    setCsvLoading(true);
    try {
      const rows = parseCsvString(csvText);
      const res = await api.commitCsv(rows);
      showToast(`Import completed! ${res.importedCount} employees added.`, 'success');
      setShowCsvModal(false);
      setCsvText('');
      setDryRunResult(null);
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setCsvLoading(false);
    }
  }

  return (
    <div className="page-wrapper animate-fade-in">
      {/* Header & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>Employee Management</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            Register new personnel, set salary structures, import CSV batches, and manage logins.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={handleExportCsv} className="btn btn-secondary btn-sm">
            <Download size={14} /> Export CSV
          </button>
          <button onClick={() => setShowCsvModal(true)} className="btn btn-secondary btn-sm">
            <FileSpreadsheet size={14} /> CSV Import (Dry Run)
          </button>
          <button
            onClick={() => {
              setRegSuccessCreds(null);
              setRegErrors([]);
              setShowRegisterModal(true);
            }}
            className="btn btn-primary btn-sm"
          >
            <UserPlus size={14} /> Register Employee
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="glass-panel"
        style={{
          padding: '12px 18px',
          marginBottom: 20,
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200 }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search by code, name, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '0.825rem', border: 'none', background: 'transparent' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Filter size={16} color="var(--text-muted)" />
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            style={{ padding: '6px 12px', fontSize: '0.825rem', width: 'auto' }}
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Employees Directory Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Employee Name</th>
                <th>Email</th>
                <th>Department</th>
                <th>Designation</th>
                <th>Basic Salary</th>
                <th>Gross (1.5x)</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
                    Loading employees directory...
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                    No employees registered yet. Click <strong>"Register Employee"</strong> or import a CSV file.
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id}>
                    <td><code style={{ fontWeight: 700 }}>{emp.employeeCode}</code></td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{emp.firstName} {emp.lastName}</div>
                      {emp.phone && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{emp.phone}</div>}
                    </td>
                    <td>{emp.email}</td>
                    <td>{emp.department?.name}</td>
                    <td>{emp.designation?.title}</td>
                    <td>${Number(emp.basicSalary).toLocaleString()}</td>
                    <td><strong style={{ color: 'var(--primary)' }}>${Number(emp.basicSalary * 1.5).toLocaleString()}</strong></td>
                    <td>
                      <span className={`badge badge-${emp.status.toLowerCase()}`}>
                        {emp.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => openEditModal(emp)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '5px 10px' }}
                      >
                        <Edit2 size={13} /> Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Register Employee Modal */}
      <Modal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        title="Register New Employee"
        maxWidth={620}
      >
        {regSuccessCreds ? (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'var(--success-light)',
                color: 'var(--success)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              <CheckCircle size={28} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>Registration Successful!</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 6 }}>
              A user account was automatically created with temporary credentials. Provide them to the employee:
            </p>

            <div
              style={{
                background: 'var(--bg-elevated)',
                padding: 16,
                borderRadius: 12,
                marginTop: 16,
                textAlign: 'left',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ fontSize: '0.825rem', marginBottom: 6 }}>
                Email: <strong>{regSuccessCreds.email}</strong>
              </div>
              <div style={{ fontSize: '0.825rem' }}>
                Temporary Password: <code style={{ color: 'var(--warning)', fontWeight: 700 }}>{regSuccessCreds.temporaryPassword}</code>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 8 }}>
                *Employee will be prompted to set a permanent password upon first sign-in.
              </div>
            </div>

            <button
              onClick={() => {
                setShowRegisterModal(false);
                setRegSuccessCreds(null);
              }}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 20 }}
            >
              Done
            </button>
          </div>
        ) : (
          <div>
            {regErrors.length > 0 && (
              <div
                style={{
                  background: 'var(--danger-light)',
                  border: '1px solid var(--danger)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  marginBottom: 14,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--danger)', marginBottom: 4 }}>
                  Validation Errors:
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.8rem', color: 'var(--danger)' }}>
                  {regErrors.map((re, idx) => (
                    <li key={idx}>
                      <strong>{re.field}:</strong> {re.message || re.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Employee Code *</label>
                <input
                  type="text"
                  placeholder="e.g. EMP-101"
                  value={registerForm.employeeCode}
                  onChange={(e) => setRegisterForm({ ...registerForm, employeeCode: e.target.value })}
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Official Email *</label>
                <input
                  type="email"
                  placeholder="employee@company.com"
                  value={registerForm.email}
                  onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>First Name *</label>
                <input
                  type="text"
                  value={registerForm.firstName}
                  onChange={(e) => setRegisterForm({ ...registerForm, firstName: e.target.value })}
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Last Name *</label>
                <input
                  type="text"
                  value={registerForm.lastName}
                  onChange={(e) => setRegisterForm({ ...registerForm, lastName: e.target.value })}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Department *</label>
                <select
                  value={registerForm.departmentId}
                  onChange={(e) => setRegisterForm({ ...registerForm, departmentId: e.target.value })}
                  required
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Designation *</label>
                <select
                  value={registerForm.designationId}
                  onChange={(e) => setRegisterForm({ ...registerForm, designationId: e.target.value })}
                  required
                >
                  {designations.map((d) => (
                    <option key={d.id} value={d.id}>{d.title}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Joining Date (ISO) *</label>
                <input
                  type="date"
                  value={registerForm.joiningDate}
                  onChange={(e) => setRegisterForm({ ...registerForm, joiningDate: e.target.value })}
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Monthly Basic Salary ($) *</label>
                <input
                  type="number"
                  min="1"
                  value={registerForm.basicSalary}
                  onChange={(e) => setRegisterForm({ ...registerForm, basicSalary: Number(e.target.value) })}
                  required
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Gross = 1.5x Basic (${Number(registerForm.basicSalary * 1.5).toLocaleString()})
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Phone Number</label>
                <input
                  type="text"
                  placeholder="+1 ..."
                  value={registerForm.phone}
                  onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Default Temporary Password</label>
                <input
                  type="text"
                  value={registerForm.temporaryPassword}
                  onChange={(e) => setRegisterForm({ ...registerForm, temporaryPassword: e.target.value })}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={regLoading}
              className="btn btn-primary"
              style={{ marginTop: 10, padding: 12 }}
            >
              {regLoading ? 'Registering...' : 'Complete Registration & Create Login'}
            </button>
          </form>
          </div>
        )}
      </Modal>

      {/* Edit Employee Details Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={`Edit Employee: ${editingEmployee?.employeeCode}`}
        maxWidth={580}
      >
        <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>First Name</label>
              <input
                type="text"
                value={editForm.firstName}
                onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                required
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Last Name</label>
              <input
                type="text"
                value={editForm.lastName}
                onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Department</label>
              <select
                value={editForm.departmentId}
                onChange={(e) => setEditForm({ ...editForm, departmentId: e.target.value })}
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Designation</label>
              <select
                value={editForm.designationId}
                onChange={(e) => setEditForm({ ...editForm, designationId: e.target.value })}
              >
                {designations.map((d) => (
                  <option key={d.id} value={d.id}>{d.title}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Basic Salary ($)</label>
              <input
                type="number"
                min="1"
                value={editForm.basicSalary}
                onChange={(e) => setEditForm({ ...editForm, basicSalary: Number(e.target.value) })}
                required
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Employment Status</label>
              <select
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="ON_LEAVE">ON_LEAVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="TERMINATED">TERMINATED</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Phone</label>
              <input
                type="text"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Exit Date (if terminated)</label>
              <input
                type="date"
                value={editForm.exitDate}
                onChange={(e) => setEditForm({ ...editForm, exitDate: e.target.value })}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={editLoading}
            className="btn btn-primary"
            style={{ marginTop: 8, padding: 12 }}
          >
            {editLoading ? 'Saving Changes...' : 'Save Changes'}
          </button>
        </form>
      </Modal>

      {/* CSV Import Modal (with Dry Run) */}
      <Modal
        isOpen={showCsvModal}
        onClose={() => {
          setShowCsvModal(false);
          setDryRunResult(null);
        }}
        title="Batch Import Employees via CSV (with Dry Run)"
        maxWidth={720}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: 0 }}>
            Paste CSV data below with headers: <code>employeeCode,firstName,lastName,email,phone,department,designation,joiningDate,basicSalary</code>
          </p>

          <textarea
            rows={6}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={`employeeCode,firstName,lastName,email,phone,department,designation,joiningDate,basicSalary\nEMP-201,Sarah,Connor,sarah@example.com,+1 555-0101,Engineering,Software Engineer,2026-06-01,75000\nEMP-202,John,Doe,john@example.com,+1 555-0102,Human Resources,HR Manager,2026-06-01,65000`}
            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
          />

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={handleDryRunCsv}
              disabled={csvLoading || !csvText.trim()}
              className="btn btn-secondary"
              style={{ flex: 1 }}
            >
              Run Dry Run Validation
            </button>

            {dryRunResult && dryRunResult.errors.length === 0 && (
              <button
                onClick={handleCommitCsv}
                disabled={csvLoading}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                Commit & Import {dryRunResult.validCount} Employees
              </button>
            )}
          </div>

          {/* Dry Run Feedback Table */}
          {dryRunResult && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Dry Run Verification Results:</span>
                <span style={{ fontSize: '0.8rem' }}>
                  Valid: <strong style={{ color: 'var(--success)' }}>{dryRunResult.validCount}</strong> | Errors: <strong style={{ color: 'var(--danger)' }}>{dryRunResult.invalidCount}</strong>
                </span>
              </div>

              {dryRunResult.errors.length > 0 ? (
                <div className="table-container" style={{ maxHeight: 200, overflowY: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Row</th>
                        <th>Field</th>
                        <th>Validation Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dryRunResult.errors.map((err, idx) => (
                        <tr key={idx}>
                          <td><strong>Row {err.row}</strong></td>
                          <td><code>{err.field}</code></td>
                          <td style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{err.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    background: 'var(--success-light)',
                    color: 'var(--success)',
                    fontSize: '0.825rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <CheckCircle size={16} /> All {dryRunResult.validCount} rows passed schema & database uniqueness validation! Ready to commit.
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
