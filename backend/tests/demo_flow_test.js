const { PrismaClient } = require('@prisma/client');

const BASE_URL = 'http://localhost:5000/api';

async function req(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const config = {
    ...options,
    headers,
  };
  if (options.body && typeof options.body === 'object' && !(options.body instanceof Buffer)) {
    config.body = JSON.stringify(options.body);
  }

  const res = await fetch(url, config);
  if (options.asBuffer) {
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }
    const buf = await res.arrayBuffer();
    return Buffer.from(buf);
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = json;
    throw err;
  }
  return json;
}

async function runDemoFlow() {
  console.log('================================================================');
  console.log('🚀 RUNNING 5-MINUTE DEMO FLOW AUDIT END-TO-END');
  console.log('================================================================\n');

  // Reset DB tables to simulate fresh install
  const prisma = new PrismaClient();
  await prisma.aiLog.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.payrollItem.deleteMany();
  await prisma.payrollRun.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.attendanceCorrection.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.designation.deleteMany();
  await prisma.department.deleteMany();
  await prisma.holiday.deleteMany();
  await prisma.leaveType.deleteMany();
  await prisma.user.deleteMany();
  await prisma.companySetting.deleteMany();

  // STEP 1: Verify Fresh Install / Setup Status
  console.log('--- Step 1: Verify Fresh Install Setup Status ---');
  const statusRes = await req('/setup/status');
  console.log('Setup status response:', statusRes);
  if (statusRes.isConfigured !== false) {
    throw new Error('Expected isConfigured to be false on fresh install');
  }

  // First-run Setup: Create Company and Admin account
  console.log('--- Step 1b: Complete First-Run Setup (Company + Admin) ---');
  const setupPayload = {
    companyName: 'Apex Innovations Corp',
    adminEmail: 'admin@apexinnovations.com',
    adminPassword: 'AdminSecurePassword2026!',
    officeStartTime: '09:00',
    officeEndTime: '18:00',
    graceMinutes: 15,
    officeLatitude: 24.8607,
    officeLongitude: 67.0011,
    officeRadiusMeters: 500,
  };
  const initialSetupRes = await req('/setup/initial', {
    method: 'POST',
    body: setupPayload,
  });
  console.log('Setup result message:', initialSetupRes.message);
  const adminToken = initialSetupRes.token;
  if (!adminToken) throw new Error('Setup did not return admin JWT token');

  // Verify setup status is now configured
  const postSetupStatus = await req('/setup/status');
  console.log('Post-setup status:', postSetupStatus);
  if (!postSetupStatus.isConfigured) throw new Error('Setup status isConfigured should now be true');

  // STEP 2: Admin Creates HR Login
  console.log('\n--- Step 2: Admin Creates HR Login ---');
  const hrPayload = {
    email: 'hr.sarah@apexinnovations.com',
    password: 'HrPassword123!',
  };
  const hrUserRes = await req('/auth/hr-users', {
    method: 'POST',
    body: hrPayload,
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log('HR user created:', hrUserRes.user.email, 'Role:', hrUserRes.user.role);

  // STEP 3: HR Logs In and Registers 2 Employees
  console.log('\n--- Step 3: HR Logs In & Registers Employees ---');
  const hrLoginRes = await req('/auth/login', {
    method: 'POST',
    body: hrPayload,
  });
  const hrToken = hrLoginRes.token;
  console.log('HR logged in successfully. Role:', hrLoginRes.user.role);

  // Get departments and designations
  const [deptsRes, desigsRes] = await Promise.all([
    req('/company/departments', { headers: { Authorization: `Bearer ${hrToken}` } }),
    req('/company/designations', { headers: { Authorization: `Bearer ${hrToken}` } }),
  ]);
  console.log('Default company departments:', deptsRes.departments.map((d) => d.name));
  console.log('Default company designations:', desigsRes.designations.map((d) => d.title));

  const engDept = deptsRes.departments.find((d) => d.name === 'Engineering') || deptsRes.departments[0];
  const salesDept = deptsRes.departments.find((d) => d.name === 'Sales & Marketing') || deptsRes.departments[1];
  const seDesignation = desigsRes.designations.find((d) => d.title.includes('Software')) || desigsRes.designations[0];
  const salesDesignation = desigsRes.designations.find((d) => d.title.includes('Account')) || desigsRes.designations[1];

  // Register Employee 1 (Software Engineer)
  const emp1Payload = {
    employeeCode: 'EMP-001',
    email: 'john.doe@apexinnovations.com',
    firstName: 'John',
    lastName: 'Doe',
    departmentId: engDept.id,
    designationId: seDesignation.id,
    joiningDate: '2026-01-01',
    basicSalary: 120000,
    phone: '+1-555-0101',
    address: '123 Tech Lane',
  };
  const emp1Res = await req('/employees/register', {
    method: 'POST',
    body: emp1Payload,
    headers: { Authorization: `Bearer ${hrToken}` },
  });
  const emp1TempPassword = emp1Res.temporaryCredentials?.temporaryPassword || 'TempPassword123!';
  const emp1Id = emp1Res.employee.id;
  console.log('Employee 1 Registered:', {
    name: `${emp1Res.employee.firstName} ${emp1Res.employee.lastName}`,
    code: emp1Res.employee.employeeCode,
    tempPassword: emp1TempPassword,
  });

  // Register Employee 2 (Sales Lead)
  const emp2Payload = {
    employeeCode: 'EMP-002',
    email: 'alice.smith@apexinnovations.com',
    firstName: 'Alice',
    lastName: 'Smith',
    departmentId: salesDept.id,
    designationId: salesDesignation.id,
    joiningDate: '2026-01-15',
    basicSalary: 100000,
    phone: '+1-555-0102',
    address: '456 Market St',
  };
  const emp2Res = await req('/employees/register', {
    method: 'POST',
    body: emp2Payload,
    headers: { Authorization: `Bearer ${hrToken}` },
  });
  console.log('Employee 2 Registered:', {
    name: `${emp2Res.employee.firstName} ${emp2Res.employee.lastName}`,
    code: emp2Res.employee.employeeCode,
  });

  // STEP 4: Employee 1 Logs In with Temporary Password & Changes Password
  console.log('\n--- Step 4: Employee 1 Login, Change Temp Password, and Stamp Attendance ---');
  const emp1LoginRes = await req('/auth/login', {
    method: 'POST',
    body: {
      email: 'john.doe@apexinnovations.com',
      password: emp1TempPassword,
    },
  });
  console.log('Employee login response:', {
    role: emp1LoginRes.user.role,
    isTemporaryPassword: emp1LoginRes.user.isTemporaryPassword,
  });
  if (!emp1LoginRes.user.isTemporaryPassword) {
    throw new Error('New employee should have isTemporaryPassword = true');
  }
  const emp1TempToken = emp1LoginRes.token;

  // Change password
  const newPassword = 'JohnSecurePassword2026!';
  const changePwRes = await req('/auth/change-password', {
    method: 'POST',
    body: {
      currentPassword: emp1TempPassword,
      newPassword,
    },
    headers: { Authorization: `Bearer ${emp1TempToken}` },
  });
  console.log('Password change result:', changePwRes.message);

  // Login with new password
  const emp1NewLogin = await req('/auth/login', {
    method: 'POST',
    body: {
      email: 'john.doe@apexinnovations.com',
      password: newPassword,
    },
  });
  const emp1Token = emp1NewLogin.token;
  console.log('Employee 1 logged in with new password. isTemporaryPassword:', emp1NewLogin.user.isTemporaryPassword);

  // Stamp Attendance (Check-in)
  const checkInRes = await req('/attendance/check-in', {
    method: 'POST',
    body: {
      latitude: 24.8607,
      longitude: 67.0011,
      notes: 'Morning check-in from headquarters',
    },
    headers: { Authorization: `Bearer ${emp1Token}` },
  });
  console.log('Employee attendance check-in:', {
    status: checkInRes.attendance.status,
    checkInTime: checkInRes.attendance.checkInTime,
    notes: checkInRes.attendance.notes,
  });

  // STEP 5: Employee Submits Smart Leave -> HR Approves
  console.log('\n--- Step 5: Smart Leave AI Natural Language Prefill & Approval Flow ---');
  // 5a. Smart Leave parsing via AI
  const smartLeaveRes = await req('/ai/smart-leave', {
    method: 'POST',
    body: { prompt: 'Need next Monday and Tuesday off for a family wedding' },
    headers: { Authorization: `Bearer ${emp1Token}` },
  });
  console.log('AI Smart Leave parsed response:', smartLeaveRes);
  const parsedLeave = smartLeaveRes.prefill || smartLeaveRes.parsed || {};

  // Get employee's leave types
  const leaveTypesRes = await req('/company/leave-types', {
    headers: { Authorization: `Bearer ${emp1Token}` },
  });
  const annualLeave = leaveTypesRes.leaveTypes.find((t) => t.code === 'ANNUAL') || leaveTypesRes.leaveTypes[0];

  // 5b. Employee manually submits the confirmed application
  const leaveAppRes = await req('/leaves/apply', {
    method: 'POST',
    body: {
      leaveTypeId: parsedLeave.leaveTypeId || annualLeave.id,
      startDate: parsedLeave.startDate || '2026-11-02',
      endDate: parsedLeave.endDate || '2026-11-03',
      reason: parsedLeave.reason || 'Family wedding',
    },
    headers: { Authorization: `Bearer ${emp1Token}` },
  });
  console.log('Leave application submitted:', {
    id: leaveAppRes.leave.id,
    workingDays: leaveAppRes.leave.workingDaysCount,
    status: leaveAppRes.leave.status,
  });
  const leaveRequestId = leaveAppRes.leave.id;

  // 5c. HR Reviews and Approves Leave
  const leaveReviewRes = await req(`/leaves/requests/${leaveRequestId}/review`, {
    method: 'PATCH',
    body: {
      status: 'APPROVED',
      reviewerComment: 'Approved. Enjoy the wedding celebration!',
    },
    headers: { Authorization: `Bearer ${hrToken}` },
  });
  console.log('HR Leave Review result:', {
    status: leaveReviewRes.leave.status,
    reviewerComment: leaveReviewRes.leave.reviewerComment,
  });

  // STEP 6: HR Opens Dashboard, Requests AI Summary, Asks AI Who Is on Leave, Drafts Payroll
  console.log('\n--- Step 6: HR Dashboard, AI KPI Digest, AI Chat & Payroll Draft ---');
  const dashMetricsRes = await req('/dashboard/metrics', {
    headers: { Authorization: `Bearer ${hrToken}` },
  });
  console.log('Dashboard KPIs:', {
    activeHeadcount: dashMetricsRes.metrics.headcount.active,
    attendanceRate: dashMetricsRes.metrics.attendance.rate,
    monthlyGrossPayroll: dashMetricsRes.metrics.payroll.monthlyGross,
  });

  // 6a. AI Dashboard Summary
  const aiSummaryRes = await req('/ai/dashboard-summary', {
    method: 'POST',
    body: { kpiData: dashMetricsRes.metrics },
    headers: { Authorization: `Bearer ${hrToken}` },
  });
  console.log('AI Dashboard Summary output:');
  console.log(aiSummaryRes.summary);
  if (!aiSummaryRes.isAiGenerated) {
    throw new Error('AI summary response must have isAiGenerated = true');
  }

  // 6b. HR Asks AI "Who is on leave?"
  const aiChatRes = await req('/ai/chat', {
    method: 'POST',
    body: { prompt: 'Who is on leave or what is the leave summary?' },
    headers: { Authorization: `Bearer ${hrToken}` },
  });
  console.log('AI Tool Calling Reply to HR:', {
    reply: aiChatRes.reply,
    toolUsed: aiChatRes.toolUsed,
    isAiGenerated: aiChatRes.isAiGenerated,
  });

  // 6c. HR Drafts Monthly Payroll
  const payrollDraftRes = await req('/payroll/runs/draft', {
    method: 'POST',
    body: {
      month: 10,
      year: 2026,
    },
    headers: { Authorization: `Bearer ${hrToken}` },
  });
  console.log('Payroll Run Draft generated:', {
    id: payrollDraftRes.run.id,
    period: `${payrollDraftRes.run.month}/${payrollDraftRes.run.year}`,
    status: payrollDraftRes.run.status,
    totalEmployees: payrollDraftRes.run.totalEmployees,
    totalGross: payrollDraftRes.run.totalGross,
    totalNet: payrollDraftRes.run.totalNet,
  });
  const payrollRunId = payrollDraftRes.run.id;

  // STEP 7: Admin Finalizes Payroll
  console.log('\n--- Step 7: Admin Finalizes Payroll Run ---');
  const finalizeRes = await req(`/payroll/runs/${payrollRunId}/finalize`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log('Payroll Finalization result:', {
    id: finalizeRes.run.id,
    status: finalizeRes.run.status,
    finalizedAt: finalizeRes.run.finalizedAt,
  });

  // STEP 8: Employee Downloads PDF Payslip & Tests AI Refusal on Colleague Salary
  console.log('\n--- Step 8: Employee Downloads PDF Payslip & Colleague Salary Refusal ---');
  // 8a. Download PDF payslip
  const pdfBuffer = await req(`/payroll/runs/${payrollRunId}/employees/${emp1Id}/pdf`, {
    headers: { Authorization: `Bearer ${emp1Token}` },
    asBuffer: true,
  });
  console.log('Payslip PDF downloaded successfully. Size:', pdfBuffer.length, 'bytes');
  if (pdfBuffer.length < 1000) {
    throw new Error('PDF output seems suspiciously small');
  }

  // 8b. Employee asks AI for colleague salary (Alice Smith)
  const salaryQueryRes = await req('/ai/chat', {
    method: 'POST',
    body: { prompt: "What is Alice Smith's salary?" },
    headers: { Authorization: `Bearer ${emp1Token}` },
  });
  console.log('AI response to colleague salary inquiry:');
  console.log(salaryQueryRes.reply);
  if (
    !salaryQueryRes.reply.toLowerCase().includes('confidential') &&
    !salaryQueryRes.reply.toLowerCase().includes('not authorized') &&
    !salaryQueryRes.reply.toLowerCase().includes('refuse') &&
    !salaryQueryRes.reply.toLowerCase().includes('cannot disclose')
  ) {
    throw new Error('AI must refuse colleague salary inquiry from employees');
  }
  console.log('✅ AI colleague-salary refusal verified!');

  // STEP 9: Admin Inspects Audit Logs and AI Logs
  console.log('\n--- Step 9: Admin Inspects Audit Logs & AI Logs ---');
  const auditRes = await req('/audit', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log('Total audit logs recorded:', auditRes.logs.length);
  console.log(
    'Audit log actions recorded:',
    auditRes.logs.slice(0, 5).map((l) => `${l.action} ${l.entity} by ${l.actorEmail}`)
  );

  // Check AI logs in DB
  const aiLogs = await prisma.aiLog.findMany();
  console.log('Total AI logs recorded in DB (ai_logs):', aiLogs.length);
  aiLogs.forEach((l, idx) => {
    console.log(` AI Log #${idx + 1}: [User: ${l.userEmail}] Tool: ${l.toolName || 'none'} | Duration: ${l.durationMs}ms`);
  });
  await prisma.$disconnect();

  console.log('\n================================================================');
  console.log('🎉 5-MINUTE DEMO FLOW COMPLETED SUCCESSFULLY WITH ZERO ERRORS!');
  console.log('================================================================\n');
}

runDemoFlow().catch((err) => {
  console.error('\n❌ DEMO FLOW FAILED:', err.message, err.data ? JSON.stringify(err.data) : '');
  process.exit(1);
});
