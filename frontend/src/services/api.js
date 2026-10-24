const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('hcm_token');
}

async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/setup/status')) {
    localStorage.removeItem('hcm_token');
    localStorage.removeItem('hcm_user');
    window.location.href = '/login';
  }

  // Handle blob responses (e.g. PDF or CSV downloads)
  if (options.responseType === 'blob') {
    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: 'Download failed' }));
      throw new Error(err.message || 'Download failed');
    }
    return await response.blob();
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.errors = data.errors;
    throw error;
  }

  return data;
}

export const api = {
  // Setup
  getSetupStatus: () => request('/setup/status'),
  performSetup: (payload) => request('/setup/initial', { method: 'POST', body: JSON.stringify(payload) }),

  // Auth
  login: (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  changePassword: (payload) => request('/auth/change-password', { method: 'POST', body: JSON.stringify(payload) }),
  getMe: () => request('/auth/me'),
  getHrUsers: () => request('/auth/hr-users'),
  createHrUser: (payload) => request('/auth/hr-users', { method: 'POST', body: JSON.stringify(payload) }),
  toggleHrUserStatus: (userId, isActive) =>
    request(`/auth/hr-users/${userId}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
  resetHrUserPassword: (userId, newPassword) =>
    request(`/auth/hr-users/${userId}/reset-password`, { method: 'POST', body: JSON.stringify({ newPassword }) }),

  // Company Settings & Masters
  getCompanySettings: () => request('/company/settings'),
  updateCompanySettings: (payload) => request('/company/settings', { method: 'PUT', body: JSON.stringify(payload) }),
  getDepartments: () => request('/company/departments'),
  createDepartment: (payload) => request('/company/departments', { method: 'POST', body: JSON.stringify(payload) }),
  deleteDepartment: (id) => request(`/company/departments/${id}`, { method: 'DELETE' }),
  getDesignations: () => request('/company/designations'),
  createDesignation: (payload) => request('/company/designations', { method: 'POST', body: JSON.stringify(payload) }),
  deleteDesignation: (id) => request(`/company/designations/${id}`, { method: 'DELETE' }),
  getLeaveTypes: () => request('/company/leave-types'),
  createLeaveType: (payload) => request('/company/leave-types', { method: 'POST', body: JSON.stringify(payload) }),
  updateLeaveType: (id, payload) => request(`/company/leave-types/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  getHolidays: (year) => request(`/company/holidays${year ? `?year=${year}` : ''}`),
  createHoliday: (payload) => request('/company/holidays', { method: 'POST', body: JSON.stringify(payload) }),
  deleteHoliday: (id) => request(`/company/holidays/${id}`, { method: 'DELETE' }),

  // Employees
  registerEmployee: (payload) => request('/employees/register', { method: 'POST', body: JSON.stringify(payload) }),
  getEmployees: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/employees${q ? `?${q}` : ''}`);
  },
  getEmployeeById: (id) => request(`/employees/${id}`),
  updateEmployeeDetails: (id, payload) => request(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  updateSelfProfile: (payload) => request('/employees/profile/self', { method: 'PATCH', body: JSON.stringify(payload) }),
  dryRunCsv: (rows) => request('/employees/import/dry-run', { method: 'POST', body: JSON.stringify({ rows }) }),
  commitCsv: (rows) => request('/employees/import/commit', { method: 'POST', body: JSON.stringify({ rows }) }),
  exportCsvBlob: () => request('/employees/export/csv', { responseType: 'blob' }),

  // Attendance
  checkIn: (payload = {}) => request('/attendance/check-in', { method: 'POST', body: JSON.stringify(payload) }),
  checkOut: (payload = {}) => request('/attendance/check-out', { method: 'POST', body: JSON.stringify(payload) }),
  getMyAttendance: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/attendance/my${q ? `?${q}` : ''}`);
  },
  getDailyAttendanceBoard: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/attendance/board${q ? `?${q}` : ''}`);
  },
  requestAttendanceCorrection: (payload) =>
    request('/attendance/corrections', { method: 'POST', body: JSON.stringify(payload) }),
  getPendingCorrections: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/attendance/corrections/pending${q ? `?${q}` : ''}`);
  },
  reviewCorrection: (id, payload) =>
    request(`/attendance/corrections/${id}/review`, { method: 'PATCH', body: JSON.stringify(payload) }),

  // Leaves
  applyLeave: (payload) => request('/leaves/apply', { method: 'POST', body: JSON.stringify(payload) }),
  cancelLeave: (id) => request(`/leaves/${id}/cancel`, { method: 'POST' }),
  getMyLeaveBalances: (year) => request(`/leaves/balances/my${year ? `?year=${year}` : ''}`),
  getLeaveRequests: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/leaves/requests${q ? `?${q}` : ''}`);
  },
  reviewLeaveRequest: (id, payload) =>
    request(`/leaves/requests/${id}/review`, { method: 'PATCH', body: JSON.stringify(payload) }),

  // Payroll
  getPayrollRuns: () => request('/payroll/runs'),
  getPayrollRunById: (id) => request(`/payroll/runs/${id}`),
  generatePayrollDraft: (payload) => request('/payroll/runs/draft', { method: 'POST', body: JSON.stringify(payload) }),
  finalizePayroll: (id) => request(`/payroll/runs/${id}/finalize`, { method: 'POST' }),
  getMyPayslips: () => request('/payroll/my-payslips'),
  downloadPayslipPdfBlob: (runId, employeeId) =>
    request(`/payroll/runs/${runId}/employees/${employeeId}/pdf`, { responseType: 'blob' }),

  // Dashboard & Analytics
  getDashboardMetrics: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/dashboard/metrics${q ? `?${q}` : ''}`);
  },

  // Announcements
  getAnnouncements: () => request('/announcements'),
  createAnnouncement: (payload) => request('/announcements', { method: 'POST', body: JSON.stringify(payload) }),

  // Notifications
  getMyNotifications: () => request('/notifications'),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => request('/notifications/read-all', { method: 'PATCH' }),

  // Audit Logs
  getAuditLogs: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/audit${q ? `?${q}` : ''}`);
  },

  // AI Assistant
  askAi: (payload) => request('/ai/chat', { method: 'POST', body: JSON.stringify(payload) }),
  parseSmartLeave: (prompt) => request('/ai/smart-leave', { method: 'POST', body: JSON.stringify({ prompt }) }),
  getAiDashboardSummary: (kpiData) => request('/ai/dashboard-summary', { method: 'POST', body: JSON.stringify({ kpiData }) }),
};
