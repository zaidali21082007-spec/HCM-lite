import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { useNotification } from '../contexts/NotificationContext';
import Modal from '../components/Modal';
import {
  Clock,
  CalendarCheck,
  CheckCircle,
  AlertTriangle,
  MapPin,
  Calendar,
  Filter,
  Check,
  X,
  FileEdit,
} from 'lucide-react';

export default function AttendancePage({ onOpenCheckInModal }) {
  const { user, isEmployee, isAdmin, isHR } = useAuth();
  const { showToast } = useNotification();

  // HR/Admin Daily Board state
  const [boardDate, setBoardDate] = useState(new Date().toISOString().substring(0, 10));
  const [boardDepartment, setBoardDepartment] = useState('');
  const [departments, setDepartments] = useState([]);
  const [boardData, setBoardData] = useState(null);

  // Employee Personal History state
  const [personalRecords, setPersonalRecords] = useState([]);
  const [historyYear, setHistoryYear] = useState(new Date().getFullYear());
  const [historyMonth, setHistoryMonth] = useState(new Date().getMonth() + 1);

  // Pending Corrections state
  const [pendingCorrections, setPendingCorrections] = useState([]);

  // Request Correction Modal
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionForm, setCorrectionForm] = useState({
    attendanceDate: new Date().toISOString().substring(0, 10),
    requestedCheckIn: `${new Date().toISOString().substring(0, 10)}T09:00`,
    requestedCheckOut: `${new Date().toISOString().substring(0, 10)}T18:00`,
    reason: '',
  });

  // Review Correction Modal
  const [selectedCorrection, setSelectedCorrection] = useState(null);
  const [reviewerComment, setReviewerComment] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDepartments();
    loadViewData();
  }, [boardDate, boardDepartment, historyYear, historyMonth]);

  async function fetchDepartments() {
    try {
      const res = await api.getDepartments();
      setDepartments(res.departments || []);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadViewData() {
    setLoading(true);
    try {
      if (isAdmin || isHR) {
        const [boardRes, corrRes] = await Promise.all([
          api.getDailyAttendanceBoard({ date: boardDate, departmentId: boardDepartment }),
          api.getPendingCorrections(),
        ]);
        setBoardData(boardRes);
        setPendingCorrections(corrRes.corrections || []);
      }

      if (isEmployee) {
        const attRes = await api.getMyAttendance({ year: historyYear, month: historyMonth });
        setPersonalRecords(attRes.records || []);
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  // Handle Correction Request (Employee)
  async function handleRequestCorrection(e) {
    e.preventDefault();
    try {
      await api.requestAttendanceCorrection({
        attendanceDate: correctionForm.attendanceDate,
        requestedCheckIn: new Date(correctionForm.requestedCheckIn).toISOString(),
        requestedCheckOut: new Date(correctionForm.requestedCheckOut).toISOString(),
        reason: correctionForm.reason,
      });
      showToast('Correction request submitted for HR approval', 'success');
      setShowCorrectionModal(false);
      setCorrectionForm({
        attendanceDate: new Date().toISOString().substring(0, 10),
        requestedCheckIn: `${new Date().toISOString().substring(0, 10)}T09:00`,
        requestedCheckOut: `${new Date().toISOString().substring(0, 10)}T18:00`,
        reason: '',
      });
      loadViewData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // Handle Review Correction (HR/Admin)
  async function handleReviewCorrection(status) {
    if (!selectedCorrection) return;
    setReviewLoading(true);
    try {
      await api.reviewCorrection(selectedCorrection.id, {
        status,
        reviewerComment,
      });
      showToast(`Correction ${status.toLowerCase()} successfully`, 'success');
      setSelectedCorrection(null);
      setReviewerComment('');
      loadViewData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setReviewLoading(false);
    }
  }

  return (
    <div className="page-wrapper animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>
            {isAdmin || isHR ? 'Daily Attendance Board & Corrections' : 'Attendance & Time Tracker'}
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            Server-stamped time tracking, 09:15 late threshold, 5-hour half-day rules, and GPS geofence checks.
          </p>
        </div>

        {isEmployee && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onOpenCheckInModal} className="btn btn-primary btn-sm">
              <Clock size={16} /> Web Check-In / Out
            </button>
            <button onClick={() => setShowCorrectionModal(true)} className="btn btn-secondary btn-sm">
              <FileEdit size={16} /> Request Correction
            </button>
          </div>
        )}
      </div>

      {/* HR / Admin View: Daily Board & Pending Corrections */}
      {(isAdmin || isHR) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Daily Board Controls & Stat Summary */}
          <div
            className="glass-panel"
            style={{
              padding: 18,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 16,
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={16} color="var(--text-muted)" />
                <input
                  type="date"
                  value={boardDate}
                  onChange={(e) => setBoardDate(e.target.value)}
                  style={{ padding: '6px 12px', fontSize: '0.825rem', width: 'auto' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Filter size={16} color="var(--text-muted)" />
                <select
                  value={boardDepartment}
                  onChange={(e) => setBoardDepartment(e.target.value)}
                  style={{ padding: '6px 12px', fontSize: '0.825rem', width: 'auto' }}
                >
                  <option value="">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Count Pills */}
            {boardData && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className="badge badge-present">Present: {boardData.presentCount}</span>
                <span className="badge badge-late">Late: {boardData.lateCount}</span>
                <span className="badge badge-half-day">Half-Day: {boardData.halfDayCount}</span>
                <span className="badge badge-absent">Absent: {boardData.absentCount}</span>
              </div>
            )}
          </div>

          {/* Daily Board Table */}
          <div className="glass-panel" style={{ overflow: 'hidden' }}>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th>Check In</th>
                    <th>Check Out</th>
                    <th>Work Duration</th>
                    <th>Geofence & Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
                        Loading attendance board...
                      </td>
                    </tr>
                  ) : boardData?.board?.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
                        No employees found for this date.
                      </td>
                    </tr>
                  ) : (
                    boardData?.board?.map((item) => {
                      const statusClass = item.status.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
                      return (
                        <tr key={item.employeeId}>
                          <td>
                            <div style={{ fontWeight: 700 }}>{item.name}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{item.employeeCode}</div>
                          </td>
                          <td>{item.department}</td>
                          <td>
                            <span className={`badge badge-${statusClass}`}>
                              {item.status}
                            </span>
                          </td>
                          <td>{item.checkIn ? new Date(item.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                          <td>{item.checkOut ? new Date(item.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                          <td>{item.workHours != null ? `${item.workHours} hrs` : '—'}</td>
                          <td style={{ fontSize: '0.75rem', color: item.isGeofenceValid ? 'var(--text-muted)' : 'var(--warning)' }}>
                            {item.remarks || (item.isGeofenceValid ? 'Verified' : 'Check location')}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pending Attendance Corrections Section */}
          <div className="glass-panel" style={{ padding: 20 }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 12 }}>
              ⏳ Pending Attendance Correction Requests ({pendingCorrections.length})
            </h3>

            {pendingCorrections.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                No correction requests waiting for review.
              </p>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Date</th>
                      <th>Requested Check In</th>
                      <th>Requested Check Out</th>
                      <th>Reason</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingCorrections.map((corr) => (
                      <tr key={corr.id}>
                        <td>
                          <strong>{corr.employee.firstName} {corr.employee.lastName}</strong>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{corr.employee.department.name}</div>
                        </td>
                        <td>{new Date(corr.attendanceDate).toISOString().substring(0, 10)}</td>
                        <td>{new Date(corr.requestedCheckIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                        <td>{new Date(corr.requestedCheckOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                        <td style={{ fontStyle: 'italic', fontSize: '0.8rem' }}>"{corr.reason}"</td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            onClick={() => setSelectedCorrection(corr)}
                            className="btn btn-primary btn-sm"
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Employee Personal Attendance Log View */}
      {isEmployee && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Month Filter */}
          <div className="glass-panel" style={{ padding: 16, display: 'flex', gap: 14, alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Filter Month:</span>
            <input
              type="number"
              min="2020"
              max="2030"
              value={historyYear}
              onChange={(e) => setHistoryYear(Number(e.target.value))}
              style={{ width: 100, padding: '6px 10px', fontSize: '0.825rem' }}
            />
            <input
              type="number"
              min="1"
              max="12"
              value={historyMonth}
              onChange={(e) => setHistoryMonth(Number(e.target.value))}
              style={{ width: 80, padding: '6px 10px', fontSize: '0.825rem' }}
            />
          </div>

          {/* Records Table */}
          <div className="glass-panel" style={{ overflow: 'hidden' }}>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Check In Time</th>
                    <th>Check Out Time</th>
                    <th>Work Duration</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {personalRecords.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
                        No attendance stamped for this month yet. Use the <strong>"Web Check-In / Out"</strong> button to stamp your shift.
                      </td>
                    </tr>
                  ) : (
                    personalRecords.map((att) => (
                      <tr key={att.id}>
                        <td><strong>{new Date(att.date).toISOString().substring(0, 10)}</strong></td>
                        <td>
                          <span className={`badge badge-${att.status.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`}>
                            {att.status}
                          </span>
                        </td>
                        <td>{new Date(att.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                        <td>{att.checkOut ? new Date(att.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : <span style={{ color: 'var(--warning)' }}>Missing check-out</span>}</td>
                        <td>{att.workHours != null ? `${att.workHours} hrs` : '—'}</td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{att.remarks || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Request Correction Modal (Employee) */}
      <Modal
        isOpen={showCorrectionModal}
        onClose={() => setShowCorrectionModal(false)}
        title="Request Attendance Correction"
      >
        <form onSubmit={handleRequestCorrection} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Attendance Date</label>
            <input
              type="date"
              value={correctionForm.attendanceDate}
              onChange={(e) => setCorrectionForm({ ...correctionForm, attendanceDate: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Corrected Check-In Time</label>
              <input
                type="datetime-local"
                value={correctionForm.requestedCheckIn}
                onChange={(e) => setCorrectionForm({ ...correctionForm, requestedCheckIn: e.target.value })}
                required
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Corrected Check-Out Time</label>
              <input
                type="datetime-local"
                value={correctionForm.requestedCheckOut}
                onChange={(e) => setCorrectionForm({ ...correctionForm, requestedCheckOut: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label>Reason for Correction</label>
            <textarea
              rows={3}
              value={correctionForm.reason}
              onChange={(e) => setCorrectionForm({ ...correctionForm, reason: e.target.value })}
              placeholder="e.g. Forgot to stamp check-out due to client emergency meeting..."
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ padding: 12 }}>
            Submit Correction for Review
          </button>
        </form>
      </Modal>

      {/* Review Correction Modal (HR/Admin) */}
      <Modal
        isOpen={!!selectedCorrection}
        onClose={() => setSelectedCorrection(null)}
        title="Review Attendance Correction"
      >
        {selectedCorrection && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'var(--bg-elevated)', padding: 14, borderRadius: 12 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                {selectedCorrection.employee.firstName} {selectedCorrection.employee.lastName} ({selectedCorrection.employee.employeeCode})
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                Date: {new Date(selectedCorrection.attendanceDate).toISOString().substring(0, 10)}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Requested In: {new Date(selectedCorrection.requestedCheckIn).toLocaleTimeString()} | Out: {new Date(selectedCorrection.requestedCheckOut).toLocaleTimeString()}
              </div>
              <div style={{ fontSize: '0.8rem', marginTop: 8, fontStyle: 'italic' }}>
                Reason: "{selectedCorrection.reason}"
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label>Reviewer Comment (Optional)</label>
              <textarea
                rows={2}
                value={reviewerComment}
                onChange={(e) => setReviewerComment(e.target.value)}
                placeholder="Add explanation note for employee..."
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <button
                type="button"
                disabled={reviewLoading}
                onClick={() => handleReviewCorrection('APPROVED')}
                className="btn btn-primary"
                style={{ background: 'var(--success)', padding: 12 }}
              >
                <Check size={16} /> Approve & Update Record
              </button>
              <button
                type="button"
                disabled={reviewLoading}
                onClick={() => handleReviewCorrection('REJECTED')}
                className="btn btn-danger"
                style={{ padding: 12 }}
              >
                <X size={16} /> Reject Request
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
