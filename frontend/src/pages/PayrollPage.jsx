import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { useNotification } from '../contexts/NotificationContext';
import Modal from '../components/Modal';
import {
  DollarSign,
  FileText,
  Lock,
  PlusCircle,
  Download,
  AlertTriangle,
  CheckCircle,
  Clock,
} from 'lucide-react';

export default function PayrollPage() {
  const { user, isAdmin, isHR, isEmployee } = useAuth();
  const { showToast } = useNotification();

  const [runs, setRuns] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [loading, setLoading] = useState(true);

  // Employee personal payslips
  const [myPayslips, setMyPayslips] = useState([]);

  // Draft Generator Modal
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftForm, setDraftForm] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  });

  useEffect(() => {
    loadPayrollData();
  }, []);

  async function loadPayrollData() {
    setLoading(true);
    try {
      if (isAdmin || isHR) {
        const res = await api.getPayrollRuns();
        setRuns(res.runs || []);
        if (res.runs?.length > 0) {
          fetchRunDetails(res.runs[0].id);
        }
      }

      if (isEmployee) {
        const res = await api.getMyPayslips();
        setMyPayslips(res.payslips || []);
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function fetchRunDetails(runId) {
    try {
      const res = await api.getPayrollRunById(runId);
      setSelectedRun(res.run);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // Generate Draft Run
  async function handleGenerateDraft(e) {
    e.preventDefault();
    setDraftLoading(true);
    try {
      const res = await api.generatePayrollDraft({
        year: Number(draftForm.year),
        month: Number(draftForm.month),
      });
      showToast(`Payroll draft for ${draftForm.month}/${draftForm.year} calculated successfully!`, 'success');
      setShowDraftModal(false);
      loadPayrollData();
      fetchRunDetails(res.run.id);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setDraftLoading(false);
    }
  }

  // Finalize Run (Admin Only)
  async function handleFinalizeRun(runId) {
    if (!confirm('Are you sure you want to finalize this payroll run? This will lock the month permanently and notify all employees.')) {
      return;
    }

    try {
      await api.finalizePayroll(runId);
      showToast('Payroll finalized and locked! Notifications dispatched.', 'success');
      loadPayrollData();
      fetchRunDetails(runId);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // Download PDF
  async function handleDownloadPdf(runId, employeeId) {
    try {
      const blob = await api.downloadPayslipPdfBlob(runId, employeeId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payslip_${runId}_${employeeId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('Payslip PDF downloaded', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  return (
    <div className="page-wrapper animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>
            {isAdmin || isHR ? 'Payroll Processing & Payslips' : 'My Official Payslips'}
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            1.5x basic gross, statutory tax slabs, automated attendance deductions, and signed PDF generation.
          </p>
        </div>

        {(isAdmin || isHR) && (
          <button onClick={() => setShowDraftModal(true)} className="btn btn-primary btn-sm">
            <PlusCircle size={16} /> Calculate Monthly Draft
          </button>
        )}
      </div>

      {/* Admin / HR View */}
      {(isAdmin || isHR) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Runs Selector Pill Bar */}
          <div className="glass-panel" style={{ padding: 14, display: 'flex', gap: 10, overflowX: 'auto', alignItems: 'center' }}>
            <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              Payroll Periods:
            </span>
            {runs.length === 0 ? (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                No payroll runs calculated yet. Click <strong>"Calculate Monthly Draft"</strong> above.
              </span>
            ) : (
              runs.map((r) => {
                const isSelected = selectedRun?.id === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => fetchRunDetails(r.id)}
                    style={{
                      background: isSelected ? 'var(--primary)' : 'var(--bg-elevated)',
                      color: isSelected ? '#FFFFFF' : 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 10,
                      padding: '6px 14px',
                      fontSize: '0.825rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span>{r.month}/{r.year}</span>
                    <span className={`badge badge-${r.status.toLowerCase()}`} style={{ fontSize: '0.65rem' }}>
                      {r.status}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Selected Run Details Card */}
          {selectedRun && (
            <div className="glass-panel" style={{ padding: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 14 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                      Payroll Run: Month {selectedRun.month} / {selectedRun.year}
                    </h3>
                    <span className={`badge badge-${selectedRun.status.toLowerCase()}`}>
                      {selectedRun.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    Working Days in Period: <strong>{selectedRun.workingDaysInMonth}</strong> (Excludes weekends & holidays)
                  </div>
                </div>

                {isAdmin && selectedRun.status === 'DRAFT' && (
                  <button
                    onClick={() => handleFinalizeRun(selectedRun.id)}
                    className="btn btn-primary"
                  >
                    <Lock size={16} /> Finalize & Lock Payroll
                  </button>
                )}
              </div>

              {/* Aggregated Totals Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
                <div style={{ background: 'var(--bg-elevated)', padding: 14, borderRadius: 12 }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Gross Earnings</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
                    ${Number(selectedRun.totalGross).toLocaleString()}
                  </div>
                </div>

                <div style={{ background: 'var(--bg-elevated)', padding: 14, borderRadius: 12 }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Deductions (Tax & Penalties)</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--danger)', marginTop: 4 }}>
                    ${Number(selectedRun.totalDeductions).toLocaleString()}
                  </div>
                </div>

                <div style={{ background: 'var(--bg-elevated)', padding: 14, borderRadius: 12 }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Net Take-Home Pay</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--success)', marginTop: 4 }}>
                    ${Number(selectedRun.totalNet).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Items Breakdown Table */}
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Basic Salary</th>
                      <th>HRA (40%) + Med (10%)</th>
                      <th>Gross (1.5x)</th>
                      <th>Per-Day Rate</th>
                      <th>Absenteeism Penalty</th>
                      <th>Income Tax TDS</th>
                      <th>Net Pay</th>
                      <th style={{ textAlign: 'right' }}>PDF Payslip</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRun.items?.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.employee.firstName} {item.employee.lastName}</strong>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {item.employee.employeeCode} • {item.employee.department.name}
                          </div>
                          {item.isProrated && (
                            <span style={{ fontSize: '0.68rem', color: 'var(--warning)', fontWeight: 600 }}>
                              {item.prorationReason}
                            </span>
                          )}
                        </td>
                        <td>${Number(item.basicSalary).toLocaleString()}</td>
                        <td>${Number(item.hraAllowance + item.medicalAllowance).toLocaleString()}</td>
                        <td><strong>${Number(item.grossSalary).toLocaleString()}</strong></td>
                        <td>${Number(item.perDaySalary).toLocaleString()}</td>
                        <td style={{ color: item.absenteeismDeduction > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                          ${Number(item.absenteeismDeduction).toLocaleString()}
                        </td>
                        <td>${Number(item.incomeTaxDeduction).toLocaleString()}</td>
                        <td>
                          <strong style={{ color: 'var(--success)', fontSize: '0.95rem' }}>
                            ${Number(item.netSalary).toLocaleString()}
                          </strong>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            onClick={() => handleDownloadPdf(selectedRun.id, item.employeeId)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 10px' }}
                          >
                            <Download size={13} /> PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Employee Personal Payslips View */}
      {isEmployee && (
        <div className="glass-panel" style={{ overflow: 'hidden' }}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Pay Period</th>
                  <th>Basic Salary</th>
                  <th>Allowances (HRA + Med)</th>
                  <th>Gross Salary</th>
                  <th>Tax & Deductions</th>
                  <th>Net Take-Home Pay</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {myPayslips.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
                      No finalized payslips available yet. Once Admin finalizes the monthly run, you can view and download signed PDF payslips here.
                    </td>
                  </tr>
                ) : (
                  myPayslips.map((item) => (
                    <tr key={item.id}>
                      <td><strong>Month {item.payrollRun.month} / {item.payrollRun.year}</strong></td>
                      <td>${Number(item.basicSalary).toLocaleString()}</td>
                      <td>${Number(item.hraAllowance + item.medicalAllowance).toLocaleString()}</td>
                      <td>${Number(item.grossSalary).toLocaleString()}</td>
                      <td style={{ color: 'var(--danger)' }}>-${Number(item.totalDeductions).toLocaleString()}</td>
                      <td><strong style={{ color: 'var(--success)', fontSize: '1.05rem' }}>${Number(item.netSalary).toLocaleString()}</strong></td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => handleDownloadPdf(item.payrollRunId, user?.employee?.id)}
                          className="btn btn-secondary btn-sm"
                        >
                          <Download size={14} /> Download PDF Payslip
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

      {/* Generate Payroll Draft Modal */}
      <Modal
        isOpen={showDraftModal}
        onClose={() => setShowDraftModal(false)}
        title="Calculate Monthly Payroll Draft"
        maxWidth={460}
      >
        <form onSubmit={handleGenerateDraft} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: 0 }}>
            Select the calendar month and year to aggregate attendance records, deductions, tax slabs, and joiner proration.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Year</label>
              <input
                type="number"
                min="2020"
                max="2035"
                value={draftForm.year}
                onChange={(e) => setDraftForm({ ...draftForm, year: Number(e.target.value) })}
                required
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Month (1-12)</label>
              <input
                type="number"
                min="1"
                max="12"
                value={draftForm.month}
                onChange={(e) => setDraftForm({ ...draftForm, month: Number(e.target.value) })}
                required
              />
            </div>
          </div>

          <div
            style={{
              padding: 10,
              borderRadius: 8,
              background: 'var(--bg-elevated)',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              lineHeight: 1.4,
            }}
          >
            * Calculates gross = 1.5x basic. Per-day rate = gross / working days. Deducts absent days, unpaid leave, and 0.5x half-days. Applies progressive tax slabs.
          </div>

          <button
            type="submit"
            disabled={draftLoading}
            className="btn btn-primary"
            style={{ marginTop: 8, padding: 12 }}
          >
            {draftLoading ? 'Calculating Payroll...' : 'Compute Draft Run'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
