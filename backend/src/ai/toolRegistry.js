const attendanceService = require('../services/attendance.service');
const leaveService = require('../services/leave.service');
const payrollService = require('../services/payroll.service');
const employeeService = require('../services/employee.service');
const dashboardService = require('../services/dashboard.service');
const companyService = require('../services/company.service');
const auditService = require('../services/audit.service');
const prisma = require('../config/prisma');
const { ROLES } = require('../config/constants');

const TOOLS = [
  // 1. get_headcount (Section 4)
  {
    name: 'get_headcount',
    description: 'Get current active company headcount, attrition rate, and distribution by department.',
    parameters: {
      type: 'object',
      properties: {
        departmentId: { type: 'string', description: 'Optional department ID or name to filter headcount' },
      },
    },
    allowedRoles: [ROLES.ADMIN, ROLES.HR],
    execute: async (user, args) => {
      let deptId = args.departmentId;
      if (deptId && deptId.length !== 36) {
        // Try to find department by name
        const dept = await prisma.department.findFirst({
          where: { name: { contains: deptId } },
        });
        if (dept) deptId = dept.id;
      }
      const metrics = await dashboardService.getDashboardMetrics({ departmentId: deptId, requestingUser: user });
      return {
        activeHeadcount: metrics.headcount.active,
        exits: metrics.headcount.exits,
        attritionRate: `${metrics.headcount.attritionRate}%`,
        departments: metrics.payroll.byDepartment.map((d) => ({
          name: d.departmentName,
          headcount: d.headcount,
        })),
      };
    },
  },

  // 2. get_attendance_summary (Section 4)
  {
    name: 'get_attendance_summary',
    description: 'Get company attendance rate, present count, late arrivals, half days, on-leave count, and absent count for today or a specific date.',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date in YYYY-MM-DD format (defaults to today)' },
      },
    },
    allowedRoles: [ROLES.ADMIN, ROLES.HR],
    execute: async (user, args) => {
      const board = await attendanceService.getDailyAttendanceBoard(args.date || null);
      const metrics = await dashboardService.getDashboardMetrics({ requestingUser: user });
      return {
        date: board.date,
        monthlyAttendanceRate: `${metrics.attendance.rate}%`,
        monthlyLatePercentage: `${metrics.attendance.latePercentage}%`,
        todayTotalEmployees: board.totalEmployees,
        todayPresent: board.presentCount,
        todayLate: board.lateCount,
        todayHalfDay: board.halfDayCount,
        todayOnLeave: board.leaveCount,
        todayAbsent: board.absentCount,
      };
    },
  },

  // 3. get_late_comers (Section 4)
  {
    name: 'get_late_comers',
    description: 'Get employees who arrived late most frequently during this month.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Maximum number of late-comers to return (default 5)' },
      },
    },
    allowedRoles: [ROLES.ADMIN, ROLES.HR],
    execute: async (user, args) => {
      const today = new Date();
      const startOfMonth = new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1));
      const endOfMonth = new Date(Date.UTC(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59));

      const lateRecords = await prisma.attendance.findMany({
        where: {
          status: 'LATE',
          date: { gte: startOfMonth, lte: endOfMonth },
        },
        include: {
          employee: {
            include: { department: true },
          },
        },
      });

      // Count late days per employee
      const counts = {};
      lateRecords.forEach((r) => {
        const id = r.employeeId;
        if (!counts[id]) {
          counts[id] = {
            employeeCode: r.employee.employeeCode,
            name: `${r.employee.firstName} ${r.employee.lastName}`,
            department: r.employee.department.name,
            lateCount: 0,
            dates: [],
          };
        }
        counts[id].lateCount += 1;
        counts[id].dates.push(r.date.toISOString().substring(0, 10));
      });

      const topLateComers = Object.values(counts)
        .sort((a, b) => b.lateCount - a.lateCount)
        .slice(0, args.limit || 5);

      return {
        month: `${today.getMonth() + 1}/${today.getFullYear()}`,
        topLateComers,
      };
    },
  },

  // 4. get_leave_summary (Section 4)
  {
    name: 'get_leave_summary',
    description: 'Get list and count of employees currently on approved leave today, categorized by leave type.',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date in YYYY-MM-DD format (defaults to today)' },
      },
    },
    allowedRoles: [ROLES.ADMIN, ROLES.HR],
    execute: async (user, args) => {
      const targetDate = args.date ? new Date(args.date) : new Date();
      const normalizedDate = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate()));

      const activeLeaves = await prisma.leaveRequest.findMany({
        where: {
          status: 'APPROVED',
          startDate: { lte: normalizedDate },
          endDate: { gte: normalizedDate },
        },
        include: {
          leaveType: true,
          employee: {
            include: { department: true },
          },
        },
      });

      return {
        date: normalizedDate.toISOString().substring(0, 10),
        totalOnLeave: activeLeaves.length,
        employees: activeLeaves.map((l) => ({
          name: `${l.employee.firstName} ${l.employee.lastName}`,
          employeeCode: l.employee.employeeCode,
          department: l.employee.department.name,
          leaveType: l.leaveType.name,
          startDate: l.startDate.toISOString().substring(0, 10),
          endDate: l.endDate.toISOString().substring(0, 10),
        })),
      };
    },
  },

  // 5. get_my_leave_balance (Section 4)
  {
    name: 'get_my_leave_balance',
    description: 'Retrieve current year leave balances and remaining quotas for the logged-in employee.',
    parameters: { type: 'object', properties: {} },
    allowedRoles: [ROLES.EMPLOYEE, ROLES.HR, ROLES.ADMIN],
    execute: async (user) => {
      if (!user.employee) return { error: 'No employee record associated with this account' };
      return await leaveService.getEmployeeLeaveBalance(user.employee.id);
    },
  },

  // 6. get_payroll_summary (Section 4)
  {
    name: 'get_payroll_summary',
    description: 'Retrieve monthly payroll run records, gross costs, net costs, and finalization status.',
    parameters: { type: 'object', properties: {} },
    allowedRoles: [ROLES.ADMIN],
    execute: async () => {
      const runs = await payrollService.listPayrollRuns();
      return runs.map((r) => ({
        id: r.id,
        period: `${r.month}/${r.year}`,
        workingDays: r.workingDaysInMonth,
        status: r.status,
        totalGross: r.totalGross,
        totalDeductions: r.totalDeductions,
        totalNet: r.totalNet,
        employeesIncluded: r._count?.items || 0,
      }));
    },
  },

  // 7. search_employees (Section 4)
  {
    name: 'search_employees',
    description: 'Search for active employees by name, code, or department.',
    parameters: {
      type: 'object',
      required: ['query'],
      properties: {
        query: { type: 'string', description: 'Search term or name' },
      },
    },
    allowedRoles: [ROLES.ADMIN, ROLES.HR],
    execute: async (user, args) => {
      const res = await employeeService.listEmployees({ search: args.query, limit: 10 });
      return {
        total: res.total,
        employees: res.employees.map((e) => ({
          code: e.employeeCode,
          name: `${e.firstName} ${e.lastName}`,
          department: e.department.name,
          designation: e.designation.title,
          status: e.status,
          joiningDate: e.joiningDate.toISOString().substring(0, 10),
        })),
      };
    },
  },

  // 8. get_company_policies (Policy Q&A - Section 4)
  {
    name: 'get_company_policies',
    description: 'Get company rules and policies including office hours, grace periods, weekend days, leave quotas, and payroll calculation formulas.',
    parameters: { type: 'object', properties: {} },
    allowedRoles: [ROLES.ADMIN, ROLES.HR, ROLES.EMPLOYEE],
    execute: async () => {
      const settings = await companyService.getCompanySettings();
      const leaveTypes = await companyService.getLeaveTypes();
      return {
        companyName: settings.companyName,
        officeStartTime: settings.officeStartTime,
        officeEndTime: settings.officeEndTime,
        graceMinutes: settings.graceMinutes,
        latePolicy: `Late mark applies after ${settings.officeStartTime} + ${settings.graceMinutes} minutes (09:15 default).`,
        halfDayPolicy: `Marked as half-day if total work duration is under ${settings.halfDayHours} hours.`,
        weekendDays: settings.weekendDays,
        leaveQuotas: leaveTypes.map((l) => ({
          type: l.name,
          quota: l.isUnpaid ? 'Unlimited' : `${l.annualQuota} days/year`,
        })),
        payrollFormulas: {
          gross: '1.5 x Basic Salary (Basic + 40% HRA + 10% Medical)',
          perDayRate: 'Gross Salary / Monthly Working Days',
          deductions: 'Per-day Rate x (Absent Days + Unpaid Leaves + 0.5 x Half Days) + Annual Progressive Income Tax / 12',
          taxSlabs: '0 to 600k: 0%; to 1.2M: 5%; 30k + 15% to 2.4M; 210k + 25% to 3.6M; 510k + 35% above',
        },
      };
    },
  },

  // 9. get_my_attendance
  {
    name: 'get_my_attendance',
    description: 'Retrieve personal attendance records for the logged-in employee for a given month and year.',
    parameters: {
      type: 'object',
      properties: {
        month: { type: 'number', description: 'Month (1-12)' },
        year: { type: 'number', description: 'Year' },
      },
    },
    allowedRoles: [ROLES.EMPLOYEE, ROLES.HR, ROLES.ADMIN],
    execute: async (user, args) => {
      if (!user.employee) return { error: 'No employee record associated with this account' };
      const now = new Date();
      const month = args.month || now.getMonth() + 1;
      const year = args.year || now.getFullYear();
      const records = await attendanceService.getEmployeeAttendance(user.employee.id, year, month);
      return {
        month,
        year,
        totalRecords: records.length,
        attendances: records.map((r) => ({
          date: r.date.toISOString().substring(0, 10),
          checkIn: r.checkIn,
          checkOut: r.checkOut,
          status: r.status,
          workHours: r.workHours,
        })),
      };
    },
  },

  // 10. get_my_latest_payslip
  {
    name: 'get_my_latest_payslip',
    description: 'Retrieve the latest finalized payslip and take-home pay for the logged-in employee.',
    parameters: { type: 'object', properties: {} },
    allowedRoles: [ROLES.EMPLOYEE, ROLES.HR, ROLES.ADMIN],
    execute: async (user) => {
      if (!user.employee) return { error: 'No employee record associated with this account' };
      const payslips = await payrollService.getEmployeePayslips(user.employee.id);
      if (payslips.length === 0) return { message: 'No finalized payslips available yet.' };
      const latest = payslips[0];
      return {
        period: `${latest.payrollRun.month}/${latest.payrollRun.year}`,
        basicSalary: latest.basicSalary,
        hraAllowance: latest.hraAllowance,
        medicalAllowance: latest.medicalAllowance,
        grossSalary: latest.grossSalary,
        totalDeductions: latest.totalDeductions,
        netSalary: latest.netSalary,
        absenteeismDeduction: latest.absenteeismDeduction,
        incomeTaxDeduction: latest.incomeTaxDeduction,
      };
    },
  },

  // 11. apply_for_leave
  {
    name: 'apply_for_leave',
    description: 'Submit a new leave application for the employee.',
    parameters: {
      type: 'object',
      required: ['leaveTypeCode', 'startDate', 'endDate', 'reason'],
      properties: {
        leaveTypeCode: { type: 'string', description: 'Leave type code: ANNUAL, SICK, CASUAL, UNPAID' },
        startDate: { type: 'string', description: 'Start date YYYY-MM-DD' },
        endDate: { type: 'string', description: 'End date YYYY-MM-DD' },
        reason: { type: 'string', description: 'Reason for leave' },
      },
    },
    allowedRoles: [ROLES.EMPLOYEE],
    execute: async (user, args) => {
      const leaveTypes = await companyService.getLeaveTypes();
      const targetType = leaveTypes.find((t) => t.code.toUpperCase() === args.leaveTypeCode.toUpperCase());
      if (!targetType) return { error: `Invalid leave type code '${args.leaveTypeCode}'. Available: ANNUAL, SICK, CASUAL, UNPAID` };

      return await leaveService.applyLeave(user.id, {
        leaveTypeId: targetType.id,
        startDate: args.startDate,
        endDate: args.endDate,
        reason: args.reason,
      });
    },
  },
];

function getToolsForUser(user) {
  return TOOLS.filter((tool) => tool.allowedRoles.includes(user.role));
}

async function executeTool(toolName, args, user) {
  const tool = TOOLS.find((t) => t.name === toolName);
  if (!tool) {
    throw new Error(`Tool '${toolName}' not found.`);
  }

  if (!tool.allowedRoles.includes(user.role)) {
    throw new Error(`Forbidden: Role '${user.role}' is not authorized to call tool '${toolName}'.`);
  }

  return await tool.execute(user, args || {});
}

module.exports = {
  TOOLS,
  getToolsForUser,
  executeTool,
};
