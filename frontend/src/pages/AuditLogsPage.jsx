import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useNotification } from '../contexts/NotificationContext';
import Modal from '../components/Modal';
import { ShieldAlert, Search, Filter, Eye, Clock, User, Terminal } from 'lucide-react';

export default function AuditLogsPage() {
  const { showToast } = useNotification();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [actorEmail, setActorEmail] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    fetchLogs();
  }, [entityFilter, actionFilter, actorEmail]);

  async function fetchLogs() {
    setLoading(true);
    try {
      const res = await api.getAuditLogs({
        entity: entityFilter,
        action: actionFilter,
        actorEmail,
        limit: 100,
      });
      setLogs(res.logs || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-wrapper animate-fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShieldAlert size={26} color="var(--primary)" /> Immutable System Audit Logs
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 4 }}>
          Tamper-evident record of actor, action, entity, and before/after JSON snapshots for create, update, approve, and finalize operations.
        </p>
      </div>

      {/* Filter Bar */}
      <div
        className="glass-panel"
        style={{
          padding: 14,
          marginBottom: 20,
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search by actor email..."
            value={actorEmail}
            onChange={(e) => setActorEmail(e.target.value)}
            style={{ padding: '6px 12px', fontSize: '0.825rem', width: 200 }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Filter size={16} color="var(--text-muted)" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            style={{ padding: '6px 12px', fontSize: '0.825rem', width: 'auto' }}
          >
            <option value="">All Actions</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="APPROVE">APPROVE</option>
            <option value="REJECT">REJECT</option>
            <option value="FINALIZE">FINALIZE</option>
            <option value="IMPORT">IMPORT</option>
            <option value="DELETE">DELETE</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            style={{ padding: '6px 12px', fontSize: '0.825rem', width: 'auto' }}
          >
            <option value="">All Entities</option>
            <option value="EMPLOYEE">EMPLOYEE</option>
            <option value="ATTENDANCE_CHECKIN">ATTENDANCE_CHECKIN</option>
            <option value="ATTENDANCE_CHECKOUT">ATTENDANCE_CHECKOUT</option>
            <option value="ATTENDANCE_CORRECTION">ATTENDANCE_CORRECTION</option>
            <option value="LEAVE_REQUEST">LEAVE_REQUEST</option>
            <option value="LEAVE_REVIEW">LEAVE_REVIEW</option>
            <option value="PAYROLL_DRAFT">PAYROLL_DRAFT</option>
            <option value="PAYROLL_FINALIZED">PAYROLL_FINALIZED</option>
            <option value="COMPANY_SETTINGS">COMPANY_SETTINGS</option>
            <option value="DEPARTMENT">DEPARTMENT</option>
            <option value="DESIGNATION">DESIGNATION</option>
            <option value="HOLIDAY">HOLIDAY</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Entity ID</th>
                <th style={{ textAlign: 'right' }}>State Diff</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
                    No audit records match the current filters.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      <Clock size={12} style={{ display: 'inline', marginRight: 4 }} />
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: '0.825rem' }}>{log.actorEmail}</div>
                      <span className={`badge badge-role-${log.actorRole.toLowerCase()}`} style={{ fontSize: '0.62rem' }}>
                        {log.actorRole}
                      </span>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background:
                            log.action === 'FINALIZE'
                              ? 'rgba(168,85,247,0.15)'
                              : log.action === 'APPROVE'
                              ? 'var(--success-light)'
                              : log.action === 'CREATE'
                              ? 'var(--primary-light)'
                              : 'var(--bg-elevated)',
                          color:
                            log.action === 'FINALIZE'
                              ? '#C084FC'
                              : log.action === 'APPROVE'
                              ? 'var(--success)'
                              : log.action === 'CREATE'
                              ? 'var(--primary)'
                              : 'var(--text-primary)',
                        }}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td><code>{log.entity}</code></td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {log.entityId ? log.entityId.substring(0, 16) + '...' : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 10px' }}
                      >
                        <Eye size={13} /> View Diff
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* JSON Diff Inspector Modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title={`Audit State Inspector: ${selectedLog?.action} on ${selectedLog?.entity}`}
        maxWidth={700}
      >
        {selectedLog && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'var(--bg-elevated)', padding: 12, borderRadius: 10, fontSize: '0.8rem' }}>
              <div><strong>Actor:</strong> {selectedLog.actorEmail} ({selectedLog.actorRole})</div>
              <div><strong>Time:</strong> {new Date(selectedLog.timestamp).toUTCString()}</div>
              <div><strong>IP Address:</strong> {selectedLog.ipAddress || 'Internal/Direct'}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  BEFORE STATE JSON:
                </span>
                <pre
                  style={{
                    background: 'var(--bg-primary)',
                    padding: 12,
                    borderRadius: 8,
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-mono)',
                    maxHeight: 250,
                    overflowY: 'auto',
                    border: '1px solid var(--border-color)',
                    marginTop: 6,
                  }}
                >
                  {selectedLog.beforeJson ? JSON.stringify(JSON.parse(selectedLog.beforeJson), null, 2) : 'null (New Record)'}
                </pre>
              </div>

              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--success)' }}>
                  AFTER STATE JSON:
                </span>
                <pre
                  style={{
                    background: 'var(--bg-primary)',
                    padding: 12,
                    borderRadius: 8,
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-mono)',
                    maxHeight: 250,
                    overflowY: 'auto',
                    border: '1px solid var(--border-color)',
                    marginTop: 6,
                  }}
                >
                  {selectedLog.afterJson ? JSON.stringify(JSON.parse(selectedLog.afterJson), null, 2) : 'null (Deleted)'}
                </pre>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
