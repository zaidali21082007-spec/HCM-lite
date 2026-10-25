import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { useNotification } from '../contexts/NotificationContext';
import Modal from '../components/Modal';
import {
  CalendarDays,
  PlusCircle,
  Check,
  X,
  AlertCircle,
  Clock,
  Filter,
  Sparkles,
} from 'lucide-react';

export default function LeavesPage() {
  const { user, isEmployee, isAdmin, isHR } = useAuth();
  const { showToast } = useNotification();

  const [balances, setBalances] = useState([]);
  const [requests, setRequests] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Smart Leave Modal state (Employee)
  const [showSmartModal, setShowSmartModal] = useState(false);
  const [smartPrompt, setSmartPrompt] = useState('');
  const [smartLoading, setSmartLoading] = useState(false);

  // Apply Leave Modal state
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyForm, setApplyForm] = useState({
    leaveTypeId: '',
    startDate: new Date().toISOString().substring(0, 10),
    endDate: new Date().toISOString().substring(0, 10),
    reason: '',
  });

  // Review Modal state (HR/Admin)
  const [selectedReviewLeave, setSelectedReviewLeave] = useState(null);
  const [reviewerComment, setReviewerComment] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  async function loadData() {
    setLoading(true);
    try {
      const [typesRes, reqRes] = await Promise.all([
        api.getLeaveTypes(),
        api.getLeaveRequests({ status: statusFilter }),
      ]);
      setLeaveTypes(typesRes.leaveTypes || []);
      setRequests(reqRes.requests || []);

      if (isEmployee) {
        const balRes = await api.getMyLeaveBalances();
        setBalances(balRes.balances || []);
      }

      if (!applyForm.leaveTypeId && typesRes.leaveTypes?.length > 0) {
        setApplyForm((prev) => ({ ...prev, leaveTypeId: typesRes.leaveTypes[0].id }));
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  // Apply Leave
  async function handleApplyLeave(e) {
    e.preventDefault();
    setApplyLoading(true);
    try {
      await api.applyLeave(applyForm);
      showToast('Leave request submitted successfully!', 'success');
      setShowApplyModal(false);
      setApplyForm({
        leaveTypeId: leaveTypes[0]?.id || '',
        startDate: new Date().toISOString().substring(0, 10),
        endDate: new Date().toISOString().substring(0, 10),
        reason: '',
      });
      loadData();
    } catch (err) {
      // Handles 422 Overlap or Over-balance
      showToast(err.message, 'error');
    } finally {
      setApplyLoading(false);
    }
  }

  // Cancel Leave (Employee)
  async function handleCancelLeave(id) {
    if (!confirm('Are you sure you want to cancel this pending leave request?')) return;
    try {
      await api.cancelLeave(id);
      showToast('Leave request cancelled', 'success');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // Review Leave (HR/Admin)
  async function handleReviewLeave(status) {
    if (!selectedReviewLeave) return;
    setReviewLoading(true);
    try {
      await api.reviewLeaveRequest(selectedReviewLeave.id, {
        status,
        reviewerComment,
      });
      showToast(`Leave request ${status.toLowerCase()} successfully`, 'success');
      setSelectedReviewLeave(null);
      setReviewerComment('');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setReviewLoading(false);
    }
  }

  // Smart Leave AI parser
  async function handleSmartLeaveParse(e) {
    e.preventDefault();
    if (!smartPrompt.trim()) return;
    setSmartLoading(true);
    try {
      const res = await api.parseSmartLeave(smartPrompt);
      const prefill = res?.prefill || res?.parsed;
      if (prefill) {
        const { startDate, endDate, reason, leaveTypeCode, leaveTypeId } = prefill;
        // Resolve matching leaveTypeId
        const matched = leaveTypes.find(
          (t) => t.id === leaveTypeId || (leaveTypeCode && t.code.toUpperCase() === leaveTypeCode.toUpperCase())
        ) || leaveTypes[0];

        setApplyForm({
          leaveTypeId: matched ? matched.id : (leaveTypes[0]?.id || ''),
          startDate: startDate || new Date().toISOString().substring(0, 10),
          endDate: endDate || startDate || new Date().toISOString().substring(0, 10),
          reason: reason || smartPrompt,
        });
        setShowSmartModal(false);
        setSmartPrompt('');
        setShowApplyModal(true);
        showToast('Smart Leave pre-filled! Please review and confirm your submission.', 'info');
      }
    } catch (err) {
      showToast(err.message || 'Failed to parse natural language leave request', 'error');
    } finally {
      setSmartLoading(false);
    }
  }

  return (
    <div className="page-wrapper animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>Leave Management</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            Working-day calculations (skipping weekends & holidays), balance quotas, and approvals.
          </p>
        </div>

        {isEmployee && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setShowSmartModal(true)}
              className="btn btn-secondary btn-sm"
              style={{
                background: 'var(--primary-light)',
                borderColor: 'var(--border-color)',
                color: 'var(--primary)',
                fontWeight: 700,
              }}
            >
              <Sparkles size={16} /> Smart Leave (AI)
            </button>
            <button onClick={() => setShowApplyModal(true)} className="btn btn-primary btn-sm">
              <PlusCircle size={16} /> Apply for Leave
            </button>
          </div>
        )}
      </div>

      {/* Leave Balance Cards (for Employee) */}
      {isEmployee && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
          {balances.map((b) => (
            <div
              key={b.leaveTypeId}
              className="glass-panel"
              style={{
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  {b.name} ({b.code})
                </span>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary)', marginTop: 6 }}>
                  {b.remainingDays}{' '}
                  <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                    days left
                  </span>
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 10 }}>
                Used: <strong>{b.usedDays}</strong> | Annual Quota: <strong>{b.annualQuota}</strong>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Requests Filter Bar */}
      <div className="glass-panel" style={{ padding: '12px 18px', marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
        <Filter size={16} color="var(--text-muted)" />
        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Filter Status:</span>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ width: 'auto', padding: '6px 12px', fontSize: '0.825rem' }}
        >
          <option value="">All Statuses</option>
          <option value="PENDING">PENDING</option>
          <option value="APPROVED">APPROVED</option>
          <option value="REJECTED">REJECTED</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>
      </div>

      {/* Leave Requests Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                {(isAdmin || isHR) && <th>Employee</th>}
                <th>Leave Type</th>
                <th>Dates Range</th>
                <th>Working Days</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Reviewer Comment</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
                    Loading leave requests...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
                    No leave requests found.
                  </td>
                </tr>
              ) : (
                requests.map((r) => (
                  <tr key={r.id}>
                    {(isAdmin || isHR) && (
                      <td>
                        <strong>{r.employee?.firstName} {r.employee?.lastName}</strong>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {r.employee?.department?.name} ({r.employee?.employeeCode})
                        </div>
                      </td>
                    )}
                    <td><strong style={{ color: 'var(--primary)' }}>{r.leaveType?.name}</strong></td>
                    <td>
                      {new Date(r.startDate).toISOString().substring(0, 10)} to {new Date(r.endDate).toISOString().substring(0, 10)}
                    </td>
                    <td><strong>{r.workingDaysCount} days</strong></td>
                    <td style={{ fontSize: '0.8rem', fontStyle: 'italic', maxWidth: 220 }}>"{r.reason}"</td>
                    <td>
                      <span className={`badge badge-${r.status.toLowerCase()}`}>
                        {r.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {r.reviewerComment || '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {/* HR/Admin Review Button */}
                      {(isAdmin || isHR) && r.status === 'PENDING' && (
                        <button
                          onClick={() => {
                            setSelectedReviewLeave(r);
                            setReviewerComment('');
                          }}
                          className="btn btn-primary btn-sm"
                        >
                          Review Request
                        </button>
                      )}

                      {/* Employee Cancel Button */}
                      {isEmployee && r.status === 'PENDING' && (
                        <button
                          onClick={() => handleCancelLeave(r.id)}
                          className="btn btn-danger btn-sm"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Smart Leave Modal (AI Assistant) */}
      <Modal
        isOpen={showSmartModal}
        onClose={() => setShowSmartModal(false)}
        title="Smart Leave Application (AI Powered)"
        maxWidth={500}
      >
        <form onSubmit={handleSmartLeaveParse} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Tell the AI in natural language when and why you need time off. For example:
            <div
              style={{
                marginTop: 6,
                padding: '8px 12px',
                background: 'var(--bg-elevated)',
                borderRadius: 6,
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
                color: 'var(--text-primary)',
              }}
            >
              "Need next Monday and Tuesday off for a family wedding"
            </div>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label>Natural Language Leave Request *</label>
            <textarea
              rows={3}
              placeholder="e.g. Taking annual leave from next Wednesday to Friday for personal travel..."
              value={smartPrompt}
              onChange={(e) => setSmartPrompt(e.target.value)}
              required
            />
          </div>

          <div
            style={{
              padding: 10,
              borderRadius: 8,
              background: 'var(--primary-light)',
              border: '1px solid var(--border-color)',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.4,
            }}
          >
            ✨ The AI will extract dates, calculate working days, and pre-fill the form for your review. It will <strong>never</strong> submit without your manual confirmation.
          </div>

          <button
            type="submit"
            disabled={smartLoading}
            className="btn btn-primary"
            style={{
              padding: 12,
              fontWeight: 700,
            }}
          >
            {smartLoading ? 'Extracting & Pre-filling...' : '✨ Parse & Pre-fill Form'}
          </button>
        </form>
      </Modal>

      {/* Apply Leave Modal (Employee) */}
      <Modal
        isOpen={showApplyModal}
        onClose={() => setShowApplyModal(false)}
        title="Apply for Leave"
        maxWidth={520}
      >
        <form onSubmit={handleApplyLeave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Leave Category *</label>
            <select
              value={applyForm.leaveTypeId}
              onChange={(e) => setApplyForm({ ...applyForm, leaveTypeId: e.target.value })}
              required
            >
              {leaveTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.isUnpaid ? 'Unpaid / Unlimited' : `${t.annualQuota} days annual quota`})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Start Date *</label>
              <input
                type="date"
                value={applyForm.startDate}
                onChange={(e) => setApplyForm({ ...applyForm, startDate: e.target.value })}
                required
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label>End Date *</label>
              <input
                type="date"
                value={applyForm.endDate}
                onChange={(e) => setApplyForm({ ...applyForm, endDate: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label>Reason *</label>
            <textarea
              rows={3}
              placeholder="State your reason for leave..."
              value={applyForm.reason}
              onChange={(e) => setApplyForm({ ...applyForm, reason: e.target.value })}
              required
            />
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
            * Working days only (skips weekends and company holidays). Overlapping requests or exceeding balance will be rejected with an alert.
          </div>

          <button
            type="submit"
            disabled={applyLoading}
            className="btn btn-primary"
            style={{ marginTop: 8, padding: 12 }}
          >
            {applyLoading ? 'Validating & Applying...' : 'Submit Leave Request'}
          </button>
        </form>
      </Modal>

      {/* Review Leave Modal (HR/Admin) */}
      <Modal
        isOpen={!!selectedReviewLeave}
        onClose={() => setSelectedReviewLeave(null)}
        title="Review Leave Application"
      >
        {selectedReviewLeave && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'var(--bg-elevated)', padding: 14, borderRadius: 12 }}>
              <div style={{ fontSize: '0.95rem', fontWeight: 800 }}>
                {selectedReviewLeave.employee?.firstName} {selectedReviewLeave.employee?.lastName} ({selectedReviewLeave.employee?.employeeCode})
              </div>
              <div style={{ fontSize: '0.825rem', color: 'var(--primary)', fontWeight: 700, marginTop: 4 }}>
                {selectedReviewLeave.leaveType?.name}: {selectedReviewLeave.workingDaysCount} Working Days
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {new Date(selectedReviewLeave.startDate).toISOString().substring(0, 10)} to {new Date(selectedReviewLeave.endDate).toISOString().substring(0, 10)}
              </div>
              <div style={{ fontSize: '0.8rem', marginTop: 8, fontStyle: 'italic' }}>
                Reason: "{selectedReviewLeave.reason}"
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label>Reviewer Decision Comment</label>
              <textarea
                rows={2}
                value={reviewerComment}
                onChange={(e) => setReviewerComment(e.target.value)}
                placeholder="Add a comment to the employee notification..."
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <button
                type="button"
                disabled={reviewLoading}
                onClick={() => handleReviewLeave('APPROVED')}
                className="btn btn-primary"
                style={{ background: 'var(--success)', padding: 12 }}
              >
                <Check size={16} /> Approve Leave
              </button>
              <button
                type="button"
                disabled={reviewLoading}
                onClick={() => handleReviewLeave('REJECTED')}
                className="btn btn-danger"
                style={{ padding: 12 }}
              >
                <X size={16} /> Reject Leave
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
