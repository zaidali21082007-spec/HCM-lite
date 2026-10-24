const http = require('http');
const prisma = require('../src/config/prisma');

function apiCall(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json;
        try { json = JSON.parse(data); } catch (e) { json = data; }
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function run() {
  console.log('--- STARTING 7-STEP COMPREHENSIVE AUDIT & VERIFICATION ---');

  // Clean up month 11 payroll run if it exists from previous run
  const prevRun = await prisma.payrollRun.findUnique({ where: { year_month: { year: 2026, month: 11 } } });
  if (prevRun) {
    await prisma.payrollItem.deleteMany({ where: { payrollRunId: prevRun.id } });
    await prisma.payrollRun.delete({ where: { id: prevRun.id } });
  }

  // Step 1: Coordinates and Geofence check
  console.log('\n--- STEP 1: Office lat/lng & radius empty; geofence skipped ---');
  // First login as Admin or check setup
  const adminLogin = await apiCall({ path: '/api/auth/login', method: 'POST' }, {
    email: 'admin@hcmlite.local',
    password: 'AdminPassword123!'
  });
  let adminToken = adminLogin.body?.token;
  if (!adminToken) {
    // If not set up yet, perform setup
    const setupRes = await apiCall({ path: '/api/setup', method: 'POST' }, {
      companyName: 'Apex Innovations',
      adminEmail: 'admin@hcmlite.local',
      adminPassword: 'AdminPassword123!',
      officeStartTime: '09:00',
      officeEndTime: '18:00',
      graceMinutes: 15,
      officeLatitude: null,
      officeLongitude: null,
      officeRadiusMeters: null
    });
    adminToken = setupRes.body.token;
  } else {
    // Update settings so lat/lng/radius are null
    await apiCall({ path: '/api/company/settings', method: 'PUT', headers: { Authorization: `Bearer ${adminToken}` } }, {
      officeLatitude: null,
      officeLongitude: null,
      officeRadiusMeters: null
    });
  }

  const settingsRes = await apiCall({ path: '/api/company/settings', method: 'GET', headers: { Authorization: `Bearer ${adminToken}` } });
  console.log('Settings coordinates & radius:', {
    lat: settingsRes.body.settings?.officeLatitude,
    lng: settingsRes.body.settings?.officeLongitude,
    radius: settingsRes.body.settings?.officeRadiusMeters
  });

  if (!adminToken) {
    console.log('Admin login failed or no token:', adminLogin.status, adminLogin.body);
  }

  // Create HR user for subsequent steps
  const hrCreateRes = await apiCall({ path: '/api/auth/hr-users', method: 'POST', headers: { Authorization: `Bearer ${adminToken}` } }, {
    email: 'hr.manager@test.local',
    password: 'Password123!',
  });
  console.log('HR user creation status:', hrCreateRes.status);

  // Step 2: Hide "Web Check-In / Out" for Admin and HR. Employee only.
  console.log('\n--- STEP 2: Check-in blocked for Admin and HR (Employee only) ---');
  const adminCheckinRes = await apiCall({ path: '/api/attendance/check-in', method: 'POST', headers: { Authorization: `Bearer ${adminToken}` } }, {});
  console.log('Admin Check-in status (expect 403):', adminCheckinRes.status, adminCheckinRes.body?.message);

  const hrLogin = await apiCall({ path: '/api/auth/login', method: 'POST' }, { email: 'hr.manager@test.local', password: 'Password123!' });
  const hrToken = hrLogin.body.token;
  const hrCheckinRes = await apiCall({ path: '/api/attendance/check-in', method: 'POST', headers: { Authorization: `Bearer ${hrToken}` } }, {});
  console.log('HR Check-in status (expect 403):', hrCheckinRes.status, hrCheckinRes.body?.message);

  // Step 3: Test as HR: register 2 employees, temp password, validation errors & CSV dry run
  console.log('\n--- STEP 3: HR registers 2 employees, temp password, errors check ---');
  // Get departments & designations
  const deptsRes = await apiCall({ path: '/api/company/departments', method: 'GET', headers: { Authorization: `Bearer ${hrToken}` } });
  const desRes = await apiCall({ path: '/api/company/designations', method: 'GET', headers: { Authorization: `Bearer ${hrToken}` } });
  const deptId = deptsRes.body.departments[0]?.id;
  const desId = desRes.body.designations[0]?.id;

  // Test registration validation errors (missing fields)
  const invalidReg = await apiCall({ path: '/api/employees/register', method: 'POST', headers: { Authorization: `Bearer ${hrToken}` } }, {
    employeeCode: '',
    email: 'invalid-email',
    firstName: '',
    lastName: '',
    departmentId: deptId,
    designationId: desId,
    joiningDate: '2026-01-01',
    basicSalary: -100
  });
  console.log('Registration validation error response (expect 400):', invalidReg.status, invalidReg.body.errors);

  // Test CSV dry run validation errors (row, field, reason)
  const csvDryRunRes = await apiCall({ path: '/api/employees/import/dry-run', method: 'POST', headers: { Authorization: `Bearer ${hrToken}` } }, {
    rows: [
      { employeeCode: '', email: 'not-an-email', firstName: '', lastName: '', department: 'Unknown', designation: 'Unknown', joiningDate: '', basicSalary: 'abc' },
      { employeeCode: 'CSV002', email: 'valid@test.local', firstName: 'John', lastName: 'Doe', department: 'Engineering', designation: 'Software Engineer', joiningDate: '2026-01-01', basicSalary: 50000 }
    ]
  });
  console.log('CSV Dry Run errors:', csvDryRunRes.body.errors);

  const tag = Date.now().toString().slice(-4);
  const emp1Email = `alice.${tag}@test.local`;
  const emp2Email = `bob.${tag}@test.local`;
  const emp1Code = `EMP-A${tag}`;
  const emp2Code = `EMP-B${tag}`;

  // Register Employee 1
  const emp1Res = await apiCall({ path: '/api/employees/register', method: 'POST', headers: { Authorization: `Bearer ${hrToken}` } }, {
    employeeCode: emp1Code,
    firstName: 'Alice',
    lastName: 'Smith',
    email: emp1Email,
    departmentId: deptId,
    designationId: desId,
    joiningDate: '2026-01-01',
    basicSalary: 60000,
    temporaryPassword: 'TempPassword123!'
  });
  console.log('Employee 1 registration:', emp1Res.status, 'Temp password login:', emp1Res.body.temporaryCredentials);

  // Register Employee 2
  const emp2Res = await apiCall({ path: '/api/employees/register', method: 'POST', headers: { Authorization: `Bearer ${hrToken}` } }, {
    employeeCode: emp2Code,
    firstName: 'Bob',
    lastName: 'Jones',
    email: emp2Email,
    departmentId: deptId,
    designationId: desId,
    joiningDate: '2026-01-01',
    basicSalary: 65000,
    temporaryPassword: 'TempPassword123!'
  });
  console.log('Employee 2 registration:', emp2Res.status, 'Temp password login:', emp2Res.body.temporaryCredentials);

  // Step 4: Test as Employee: first login forces password change, check-in works, leave request with overlap/balance, cancel works
  console.log('\n--- STEP 4: Employee first login forces pw change, check-in, leave checks ---');
  const emp1Login = await apiCall({ path: '/api/auth/login', method: 'POST' }, {
    email: emp1Email,
    password: 'TempPassword123!'
  });
  console.log('Employee 1 first login isTemporaryPassword:', emp1Login.body.user.isTemporaryPassword);

  const emp1Token = emp1Login.body.token;
  // Change password
  const changePwRes = await apiCall({ path: '/api/auth/change-password', method: 'POST', headers: { Authorization: `Bearer ${emp1Token}` } }, {
    currentPassword: 'TempPassword123!',
    newPassword: 'AlicePermanentPass123!'
  });
  console.log('Employee 1 password changed:', changePwRes.body.message);

  // Re-login with new password
  const emp1NewLogin = await apiCall({ path: '/api/auth/login', method: 'POST' }, {
    email: emp1Email,
    password: 'AlicePermanentPass123!'
  });
  const aliceToken = emp1NewLogin.body.token;
  const aliceEmpId = emp1Res.body.employee.id;

  // Employee check-in works (with coordinates empty -> geofence skipped)
  const empCheckIn = await apiCall({ path: '/api/attendance/check-in', method: 'POST', headers: { Authorization: `Bearer ${aliceToken}` } }, {});
  console.log('Employee check-in status:', empCheckIn.status, 'Remarks:', empCheckIn.body.attendance?.remarks, 'Status:', empCheckIn.body.attendance?.status);

  // Leave balance & overlap checks
  const leaveTypesRes = await apiCall({ path: '/api/leaves/types', method: 'GET', headers: { Authorization: `Bearer ${aliceToken}` } });
  const paidLeaveTypeId = leaveTypesRes.body.leaveTypes.find(t => !t.isUnpaid)?.id;

  // Request leave exceeding balance (e.g. 50 days) -> expect 422
  const exceedLeaveRes = await apiCall({ path: '/api/leaves/apply', method: 'POST', headers: { Authorization: `Bearer ${aliceToken}` } }, {
    leaveTypeId: paidLeaveTypeId,
    startDate: '2026-11-01',
    endDate: '2026-12-30',
    reason: 'Exceeding balance vacation'
  });
  console.log('Exceeding leave balance status (expect 422):', exceedLeaveRes.status, exceedLeaveRes.body?.message);

  // Request valid leave
  const validLeaveRes = await apiCall({ path: '/api/leaves/apply', method: 'POST', headers: { Authorization: `Bearer ${aliceToken}` } }, {
    leaveTypeId: paidLeaveTypeId,
    startDate: '2026-11-10',
    endDate: '2026-11-12',
    reason: 'Personal time off'
  });
  console.log('Valid leave applied status (expect 201):', validLeaveRes.status, 'Leave ID:', validLeaveRes.body.leave?.id);
  const leave1Id = validLeaveRes.body.leave?.id;

  // Request overlapping leave -> expect 422
  const overlapLeaveRes = await apiCall({ path: '/api/leaves/apply', method: 'POST', headers: { Authorization: `Bearer ${aliceToken}` } }, {
    leaveTypeId: paidLeaveTypeId,
    startDate: '2026-11-11',
    endDate: '2026-11-15',
    reason: 'Overlapping leave'
  });
  console.log('Overlapping leave status (expect 422):', overlapLeaveRes.status, overlapLeaveRes.body?.message);

  // Apply another leave to test cancel
  const leaveToCancelRes = await apiCall({ path: '/api/leaves/apply', method: 'POST', headers: { Authorization: `Bearer ${aliceToken}` } }, {
    leaveTypeId: paidLeaveTypeId,
    startDate: '2026-11-20',
    endDate: '2026-11-21',
    reason: 'To be cancelled'
  });
  const cancelLeaveId = leaveToCancelRes.body.leave?.id;
  const cancelRes = await apiCall({ path: `/api/leaves/${cancelLeaveId}/cancel`, method: 'POST', headers: { Authorization: `Bearer ${aliceToken}` } }, {});
  console.log('Cancel leave status (expect 200):', cancelRes.status, 'Cancelled status:', cancelRes.body.leave?.status);

  // Step 5: Test as HR: approve leave with comment, attendance board update, create payroll draft
  console.log('\n--- STEP 5: HR approves leave with comment, attendance board, payroll draft ---');
  // HR approves leave1Id with comment
  const approveRes = await apiCall({ path: `/api/leaves/requests/${leave1Id}/review`, method: 'PATCH', headers: { Authorization: `Bearer ${hrToken}` } }, {
    status: 'APPROVED',
    reviewerComment: 'Approved by HR Manager. Enjoy your rest.'
  });
  console.log('HR approved leave with comment (expect 200):', approveRes.status, 'Comment:', approveRes.body.leave?.reviewerComment);

  // Check attendance board for the approved leave date (2026-11-10)
  const boardRes = await apiCall({ path: `/api/attendance/board?date=2026-11-10`, method: 'GET', headers: { Authorization: `Bearer ${hrToken}` } });
  const aliceBoardEntry = boardRes.body.board?.find(r => r.employeeCode === emp1Code);
  console.log('Attendance board status for Alice on 2026-11-10 (expect ON_LEAVE):', aliceBoardEntry?.status);

  // HR creates payroll draft for month 11
  const draftRes = await apiCall({ path: '/api/payroll/runs/draft', method: 'POST', headers: { Authorization: `Bearer ${hrToken}` } }, {
    year: 2026,
    month: 11
  });
  console.log('Payroll draft created status:', draftRes.status, 'Run ID:', draftRes.body.run?.id, 'Status:', draftRes.body.run?.status);
  const runId = draftRes.body.run?.id;

  // Step 6: Test as Admin: finalize payroll, confirm run can no longer be edited
  console.log('\n--- STEP 6: Admin finalizes payroll, confirms run locked ---');
  const finalizeRes = await apiCall({ path: `/api/payroll/runs/${runId}/finalize`, method: 'POST', headers: { Authorization: `Bearer ${adminToken}` } }, {});
  console.log('Admin finalize status:', finalizeRes.status, 'Finalized status:', finalizeRes.body.run?.status);

  // Attempt to generate draft for the same month again (expect 403 / 400 locked error)
  const editLockedRes = await apiCall({ path: '/api/payroll/runs/draft', method: 'POST', headers: { Authorization: `Bearer ${adminToken}` } }, {
    year: 2026,
    month: 11
  });
  console.log('Attempt to edit finalized month status (expect 403):', editLockedRes.status, editLockedRes.body?.message);

  // Step 7: Test as Employee: download payslip PDF. Confirm cannot see another employee's data (expect 403)
  console.log('\n--- STEP 7: Employee payslip download, 403 on another employee data ---');
  // Employee 1 downloads own payslip PDF
  const ownPdfRes = await apiCall({ path: `/api/payroll/runs/${runId}/employees/${aliceEmpId}/pdf`, method: 'GET', headers: { Authorization: `Bearer ${aliceToken}` } });
  console.log('Alice downloads own payslip PDF status (expect 200):', ownPdfRes.status, 'Content-Type:', ownPdfRes.headers['content-type']);

  // Employee 1 attempts to download Employee 2's payslip PDF -> expect 403
  const bobEmpId = emp2Res.body.employee.id;
  const crossPdfRes = await apiCall({ path: `/api/payroll/runs/${runId}/employees/${bobEmpId}/pdf`, method: 'GET', headers: { Authorization: `Bearer ${aliceToken}` } });
  console.log('Alice attempts to download Bob payslip PDF (expect 403):', crossPdfRes.status, crossPdfRes.body?.message);

  // Employee 1 attempts to access payroll run details directly -> expect 403
  const crossRunRes = await apiCall({ path: `/api/payroll/runs/${runId}`, method: 'GET', headers: { Authorization: `Bearer ${aliceToken}` } });
  console.log('Alice attempts to access full payroll run (expect 403):', crossRunRes.status, crossRunRes.body?.message);

  // Employee 1 attempts to access Bob employee details directly -> expect 403
  const crossEmpRes = await apiCall({ path: `/api/employees/${bobEmpId}`, method: 'GET', headers: { Authorization: `Bearer ${aliceToken}` } });
  console.log('Alice attempts to access Bob profile (expect 403):', crossEmpRes.status, crossEmpRes.body?.message);

  console.log('\n--- ALL 7 STEPS VERIFICATION FINISHED ---');
}

run().catch(console.error);
