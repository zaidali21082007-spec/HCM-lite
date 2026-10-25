import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import StatCard from '../components/StatCard';
import {
  Users,
  CalendarCheck,
  Clock,
  UserMinus,
  AlertCircle,
  DollarSign,
  TrendingUp,
  FileText,
  Calendar,
  Filter,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

export default function DashboardPage({ onOpenCheckInModal, onOpenAiModal }) {
  const { user, isEmployee } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);

  useEffect(() => {
    fetchDepartments();
    loadDashboard();
  }, [selectedDept]);

  async function fetchDepartments() {
    try {
      const res = await api.getDepartments();
      setDepartments(res.departments || []);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadDashboard() {
    setLoading(true);
    try {
      const params = {};
      if (selectedDept) params.departmentId = selectedDept;
      const res = await api.getDashboardMetrics(params);
      setMetrics(res.metrics);
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSummarizeDashboard() {
    if (!metrics) return;
    setAiSummaryLoading(true);
    try {
      const res = await api.getAiDashboardSummary(metrics);
      setAiSummary(res.summary);
    } catch (err) {
      alert(`AI Summary failed: ${err.message}`);
    } finally {
      setAiSummaryLoading(false);
    }
  }

  async function handleDownloadPayslip(runId, employeeId) {
    try {
      const blob = await api.downloadPayslipPdfBlob(runId, employeeId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payslip_${runId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert(`Download failed: ${err.message}`);
    }
  }

  if (loading) {
    return (
      <div className="page-wrapper" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading dashboard metrics...
      </div>
    );
  }

  // Employee Personal View
  if (isEmployee && metrics?.isPersonal) {
    return (
      <div className="page-wrapper animate-fade-in">
        {/* Welcome Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>
              Welcome back, {user?.employee?.firstName || user?.email}!
            </h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 4 }}>
              Here is your personal attendance, leave balance, and compensation snapshot.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onOpenCheckInModal} className="btn btn-primary">
              <Clock size={16} /> Stamp Attendance
            </button>
            <button onClick={onOpenAiModal} className="btn btn-secondary">
              Ask AI Assistant
            </button>
          </div>
        </div>

        {/* Top Personal Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
          <StatCard
            title="Days Present This Month"
            value={metrics.stats.daysPresent}
            subtitle={`${metrics.stats.daysLate} late arrivals`}
            icon={CalendarCheck}
            color="var(--success)"
          />
          <StatCard
            title="Half-Day Records"
            value={metrics.stats.halfDays}
            subtitle="Shifts under 5.0 hours"
            icon={Clock}
            color="var(--accent)"
          />
          <StatCard
            title="Total Tracked Days"
            value={metrics.stats.totalTracked}
            subtitle={`Month ${metrics.month}/${metrics.year}`}
            icon={Calendar}
            color="var(--primary)"
          />
        </div>

        {/* Leave Balances Grid */}
        <div className="glass-panel" style={{ padding: 20, marginBottom: 24 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 14 }}>
            🏖️ Remaining Leave Balances ({metrics.year})
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
            {metrics.leaveBalances?.map((lb) => (
              <div
                key={lb.id}
                style={{
                  background: 'var(--bg-elevated)',
                  padding: 14,
                  borderRadius: 12,
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{lb.name}</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)', marginTop: 4 }}>
                  {lb.remaining} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>days left</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Used: {lb.used} / Quota: {lb.quota}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Latest Payslip & Recent Leaves */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {/* Latest Payslip Card */}
          <div className="glass-panel" style={{ padding: 20 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <DollarSign size={18} color="var(--primary)" /> Latest Finalized Payslip
            </h3>

            {metrics.latestPayslip ? (
              <div>
                <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                  Pay Period: <strong>{metrics.latestPayslip.period}</strong>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--success)', margin: '8px 0' }}>
                  ${Number(metrics.latestPayslip.netSalary).toLocaleString()}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                  Gross: ${Number(metrics.latestPayslip.grossSalary).toLocaleString()} | Deductions: ${Number(metrics.latestPayslip.totalDeductions).toLocaleString()}
                </div>

                <button
                  onClick={() => handleDownloadPayslip(metrics.latestPayslip.payrollRunId, user?.employee?.id)}
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%' }}
                >
                  <FileText size={14} /> Download Official PDF Payslip
                </button>
              </div>
            ) : (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                No finalized payroll run available yet. Once Admin finalizes the monthly payroll, your signed PDF payslip will appear here.
              </p>
            )}
          </div>

          {/* Recent Leaves */}
          <div className="glass-panel" style={{ padding: 20 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calendar size={18} color="var(--primary)" /> Recent Leave Requests
            </h3>

            {metrics.recentLeaves?.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No leave requests submitted yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {metrics.recentLeaves?.map((lv) => (
                  <div
                    key={lv.id}
                    style={{
                      padding: 10,
                      background: 'var(--bg-elevated)',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.825rem', fontWeight: 700 }}>{lv.leaveType?.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {new Date(lv.startDate).toISOString().substring(0, 10)} to {new Date(lv.endDate).toISOString().substring(0, 10)} ({lv.workingDaysCount} working days)
                      </div>
                    </div>
                    <span className={`badge badge-${lv.status.toLowerCase()}`}>{lv.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Company Executive / HR View
  return (
    <div className="page-wrapper animate-fade-in">
      {/* Title & Filter Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>Executive Analytics & Dashboard</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            Real-time DB-aggregated headcount, attendance rates, leave utilization, and payroll metrics.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Department Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Filter size={16} color="var(--text-muted)" />
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              style={{ padding: '6px 12px', fontSize: '0.825rem', width: 'auto' }}
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleSummarizeDashboard}
              disabled={aiSummaryLoading}
              className="btn btn-secondary btn-sm"
              style={{
                background: 'var(--primary-light)',
                borderColor: 'var(--border-color)',
                color: 'var(--primary)',
                fontWeight: 700,
              }}
            >
              <Sparkles size={15} />
              {aiSummaryLoading ? 'Generating Insights...' : 'Summarize Dashboard (AI)'}
            </button>
            <button onClick={onOpenAiModal} className="btn btn-primary btn-sm">
              Ask AI on Company Data
            </button>
          </div>
        </div>
      </div>

      {/* AI Dashboard Executive Summary Card */}
      {aiSummary && (
        <div
          className="glass-panel animate-fade-in"
          style={{
            padding: '16px 20px',
            marginBottom: 24,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-color)',
            borderRadius: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  background: 'var(--primary-light)',
                  color: 'var(--primary)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '2px 8px',
                  borderRadius: 4,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Sparkles size={11} />
                AI-generated
              </span>
              <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                Executive Insights & KPI Digest
              </strong>
            </div>
            <button
              onClick={() => setAiSummary(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.8rem',
              }}
            >
              Dismiss
            </button>
          </div>
          <div
            style={{
              fontSize: '0.85rem',
              lineHeight: 1.6,
              color: 'var(--text-secondary)',
              whiteSpace: 'pre-wrap',
            }}
          >
            {aiSummary}
          </div>
        </div>
      )}

      {/* Core Aggregated KPIs Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard
          title="Active Headcount"
          value={metrics?.headcount?.active || 0}
          subtitle={`Attrition rate: ${metrics?.headcount?.attritionRate || 0}%`}
          icon={Users}
          color="var(--primary)"
        />
        <StatCard
          title="Attendance Rate"
          value={`${metrics?.attendance?.rate || 0}%`}
          subtitle="Effective present / active records"
          icon={CalendarCheck}
          color="var(--success)"
        />
        <StatCard
          title="Late Arrival Rate"
          value={`${metrics?.attendance?.latePercentage || 0}%`}
          subtitle="Late check-ins / (present + late)"
          icon={Clock}
          color="var(--warning)"
        />
        <StatCard
          title="Absenteeism Rate"
          value={`${metrics?.attendance?.absenteeismRate || 0}%`}
          subtitle="Absent days / expected working days"
          icon={AlertCircle}
          color="var(--danger)"
        />
      </div>

      {/* Recharts Analytics Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: 20, marginBottom: 24 }}>
        {/* Attendance Trend Chart */}
        <div className="glass-panel" style={{ padding: 20 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 14 }}>
            Attendance History (Recent Days)
          </h3>
          <div style={{ height: 260, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics?.attendance?.attendanceTrend || []}>
                <defs>
                  <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--success)" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="var(--success)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorLate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--warning)" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="var(--warning)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} />
                <YAxis stroke="var(--text-muted)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-secondary)',
                    borderColor: 'var(--border-color)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="present" stroke="var(--success)" fillOpacity={1} fill="url(#colorPresent)" name="Present" />
                <Area type="monotone" dataKey="late" stroke="var(--warning)" fillOpacity={1} fill="url(#colorLate)" name="Late" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Payroll Cost & Average Salary */}
        <div className="glass-panel" style={{ padding: 20 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 14 }}>
            Monthly Payroll Cost & Headcount Trends
          </h3>
          <div style={{ height: 260, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics?.payroll?.trends || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="period" stroke="var(--text-muted)" fontSize={11} />
                <YAxis stroke="var(--text-muted)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-secondary)',
                    borderColor: 'var(--border-color)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend />
                <Bar dataKey="totalCost" fill="var(--primary)" radius={[4, 4, 0, 0]} name="Total Gross ($)" />
                <Bar dataKey="avgSalary" fill="var(--accent)" radius={[4, 4, 0, 0]} name="Avg Salary ($)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Leave Utilization & Department Payroll Breakdowns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: 20 }}>
        {/* Leave Utilization Table */}
        <div className="glass-panel" style={{ padding: 20 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 14 }}>
            Leave Utilization (Approved Days / Quota)
          </h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Leave Type</th>
                  <th>Approved Days</th>
                  <th>Total Quota</th>
                  <th>Utilization %</th>
                </tr>
              </thead>
              <tbody>
                {metrics?.leaveUtilization?.map((item) => (
                  <tr key={item.leaveTypeId}>
                    <td><strong>{item.leaveName}</strong></td>
                    <td>{item.approvedDays}</td>
                    <td>{item.totalQuota}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 80, height: 6, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${Math.min(100, item.utilizationRate)}%`,
                              height: '100%',
                              background: item.utilizationRate > 80 ? 'var(--danger)' : 'var(--primary)',
                            }}
                          />
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{item.utilizationRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Department Payroll Breakdown */}
        <div className="glass-panel" style={{ padding: 20 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 14 }}>
            Department Payroll & Headcount Distribution
          </h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Active Staff</th>
                  <th>Total Cost</th>
                  <th>Avg Salary</th>
                </tr>
              </thead>
              <tbody>
                {metrics?.payroll?.byDepartment?.map((dept) => (
                  <tr key={dept.departmentId}>
                    <td><strong>{dept.departmentName}</strong></td>
                    <td>{dept.headcount}</td>
                    <td>${Number(dept.totalGrossCost).toLocaleString()}</td>
                    <td>${Number(dept.averageSalary).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
