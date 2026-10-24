const prisma = require('../config/prisma');
const { ATTENDANCE_STATUS, LEAVE_STATUS, ROLES } = require('../config/constants');
const { normalizeDateOnly, getWorkingDaysBetween, formatDateYMD } = require('../utils/dateUtils');

async function getDashboardMetrics({ departmentId = null, startDate = null, endDate = null, requestingUser }) {
  // If requesting user is an employee, return personalized employee dashboard metrics
  if (requestingUser?.role === ROLES.EMPLOYEE) {
    return await getEmployeePersonalDashboard(requestingUser.employee?.id);
  }

  const today = new Date();
  const start = startDate ? new Date(startDate) : new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1));
  const end = endDate ? new Date(endDate) : new Date(Date.UTC(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59));

  const empWhere = {};
  if (departmentId) empWhere.departmentId = departmentId;

  // 1. Headcount & Attrition %
  // Attrition % = exits / average headcount x 100
  const activeHeadcount = await prisma.employee.count({
    where: {
      ...empWhere,
      status: 'ACTIVE',
    },
  });

  const periodExits = await prisma.employee.count({
    where: {
      ...empWhere,
      exitDate: { gte: start, lte: end },
    },
  });

  // Beginning of period headcount
  const beginningHeadcount = await prisma.employee.count({
    where: {
      ...empWhere,
      joiningDate: { lt: start },
      OR: [{ exitDate: null }, { exitDate: { gte: start } }],
    },
  });

  const averageHeadcount = Math.max(1, (beginningHeadcount + activeHeadcount) / 2);
  const attritionRate = Number(((periodExits / averageHeadcount) * 100).toFixed(2));

  // 2. Attendance & Absenteeism Metrics
  // Attendance records within period
  const attWhere = {
    date: { gte: start, lte: end },
  };
  if (departmentId) {
    attWhere.employee = { departmentId };
  }

  const attendanceAggregates = await prisma.attendance.groupBy({
    by: ['status'],
    where: attWhere,
    _count: { _all: true },
  });

  const statusCounts = {
    PRESENT: 0,
    LATE: 0,
    HALF_DAY: 0,
    MISSING_CHECKOUT: 0,
    ABSENT: 0,
  };
  attendanceAggregates.forEach((item) => {
    statusCounts[item.status] = item._count._all;
  });

  // Approved leave days in the period
  const leaveWhere = {
    status: LEAVE_STATUS.APPROVED,
    startDate: { lte: end },
    endDate: { gte: start },
  };
  if (departmentId) {
    leaveWhere.employee = { departmentId };
  }
  const approvedLeaves = await prisma.leaveRequest.findMany({
    where: leaveWhere,
    select: { workingDaysCount: true },
  });
  const onLeaveDays = approvedLeaves.reduce((sum, l) => sum + l.workingDaysCount, 0);

  // Total working-day records = sum of present, late, half_day, missing_checkout, absent + on_leave
  const totalAttRecords =
    statusCounts.PRESENT +
    statusCounts.LATE +
    statusCounts.HALF_DAY +
    statusCounts.MISSING_CHECKOUT +
    statusCounts.ABSENT;

  // Formula: Attendance rate = (present + late + missing_checkout + 0.5 x half_day) / (working-day records - on_leave)
  const effectivePresentSum =
    statusCounts.PRESENT + statusCounts.LATE + statusCounts.MISSING_CHECKOUT + 0.5 * statusCounts.HALF_DAY;
  const denominator = Math.max(1, totalAttRecords); // or working-day records
  const attendanceRate = Number(((effectivePresentSum / denominator) * 100).toFixed(2));

  // Formula: Late % = late / (present + late)
  const presentPlusLate = statusCounts.PRESENT + statusCounts.LATE;
  const lateRate = presentPlusLate > 0 ? Number(((statusCounts.LATE / presentPlusLate) * 100).toFixed(2)) : 0;

  // Company settings & working days in period
  const settings = await prisma.companySetting.findFirst();
  const weekendDays = (settings?.weekendDays || 'Saturday,Sunday').split(',');
  const holidays = await prisma.holiday.findMany({
    where: { date: { gte: start, lte: end } },
  });
  const holidayDates = holidays.map((h) => formatDateYMD(h.date));
  const workingDaysInPeriod = getWorkingDaysBetween(start, end, weekendDays, holidayDates).count;

  // Expected working days = active employees x working days in period
  const expectedWorkingDays = Math.max(1, activeHeadcount * workingDaysInPeriod);
  // Absenteeism = absent days / expected working days
  const absenteeismRate = Number(((statusCounts.ABSENT / expectedWorkingDays) * 100).toFixed(2));

  // 3. Leave Utilization per leave type and department
  // Leave utilization = approved days / quota, per leave type and department
  const leaveTypes = await prisma.leaveType.findMany();
  const departments = await prisma.department.findMany();

  const leaveUtilization = [];

  for (const lt of leaveTypes) {
    if (lt.isUnpaid) continue; // Unpaid has unlimited quota

    const typeLeaves = await prisma.leaveRequest.findMany({
      where: {
        leaveTypeId: lt.id,
        status: LEAVE_STATUS.APPROVED,
        startDate: { gte: start },
        endDate: { lte: end },
        ...(departmentId ? { employee: { departmentId } } : {}),
      },
      include: { employee: true },
    });

    const approvedDays = typeLeaves.reduce((sum, l) => sum + l.workingDaysCount, 0);
    const eligibleEmployeesCount = departmentId
      ? await prisma.employee.count({ where: { departmentId, status: 'ACTIVE' } })
      : activeHeadcount;

    const totalQuota = Math.max(1, eligibleEmployeesCount * lt.annualQuota);
    const utilizationRate = Number(((approvedDays / totalQuota) * 100).toFixed(2));

    leaveUtilization.push({
      leaveTypeId: lt.id,
      leaveName: lt.name,
      leaveCode: lt.code,
      approvedDays,
      totalQuota,
      utilizationRate,
    });
  }

  // 4. Payroll cost and average salary by month and department
  const payrollRuns = await prisma.payrollRun.findMany({
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    take: 6,
    include: {
      items: {
        where: departmentId ? { employee: { departmentId } } : {},
      },
    },
  });

  const payrollTrends = payrollRuns.reverse().map((run) => {
    const totalCost = run.items.reduce((sum, item) => sum + item.grossSalary, 0);
    const avgSalary = run.items.length > 0 ? Number((totalCost / run.items.length).toFixed(2)) : 0;
    return {
      period: `${run.month}/${run.year}`,
      totalCost: Number(totalCost.toFixed(2)),
      avgSalary,
      employeesCount: run.items.length,
      status: run.status,
    };
  });

  // Department-wise payroll breakdown
  const departmentPayroll = [];
  for (const dept of departments) {
    const deptEmployees = await prisma.employee.findMany({
      where: { departmentId: dept.id, status: 'ACTIVE' },
      select: { basicSalary: true, allowances: true },
    });

    const deptGross = deptEmployees.reduce((sum, e) => sum + e.basicSalary * 1.5, 0);
    const deptAvg = deptEmployees.length > 0 ? Number((deptGross / deptEmployees.length).toFixed(2)) : 0;

    departmentPayroll.push({
      departmentId: dept.id,
      departmentName: dept.name,
      headcount: deptEmployees.length,
      totalGrossCost: Number(deptGross.toFixed(2)),
      averageSalary: deptAvg,
    });
  }

  // Daily attendance trend for charts (last 7 working days)
  const recentAttendances = await prisma.attendance.groupBy({
    by: ['date', 'status'],
    where: {
      date: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      ...(departmentId ? { employee: { departmentId } } : {}),
    },
    _count: { _all: true },
  });

  const dateMap = {};
  recentAttendances.forEach((r) => {
    const dStr = r.date.toISOString().substring(0, 10);
    if (!dateMap[dStr]) {
      dateMap[dStr] = { date: dStr, present: 0, late: 0, halfDay: 0, absent: 0 };
    }
    if (r.status === ATTENDANCE_STATUS.PRESENT) dateMap[dStr].present += r._count._all;
    if (r.status === ATTENDANCE_STATUS.LATE) dateMap[dStr].late += r._count._all;
    if (r.status === ATTENDANCE_STATUS.HALF_DAY) dateMap[dStr].halfDay += r._count._all;
    if (r.status === ATTENDANCE_STATUS.ABSENT) dateMap[dStr].absent += r._count._all;
  });

  const attendanceTrend = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));

  return {
    period: {
      startDate: start.toISOString().substring(0, 10),
      endDate: end.toISOString().substring(0, 10),
    },
    headcount: {
      active: activeHeadcount,
      exits: periodExits,
      attritionRate,
    },
    attendance: {
      rate: attendanceRate,
      latePercentage: lateRate,
      absenteeismRate,
      statusCounts,
      totalRecords: totalAttRecords,
      attendanceTrend,
    },
    leaveUtilization,
    payroll: {
      trends: payrollTrends,
      byDepartment: departmentPayroll,
    },
  };
}

async function getEmployeePersonalDashboard(employeeId) {
  if (!employeeId) return null;

  const today = new Date();
  const startOfMonth = new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1));
  const endOfMonth = new Date(Date.UTC(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59));

  const [attendances, leaveBalances, recentLeaves, latestPayslip] = await Promise.all([
    prisma.attendance.findMany({
      where: {
        employeeId,
        date: { gte: startOfMonth, lte: endOfMonth },
      },
      orderBy: { date: 'desc' },
    }),
    prisma.leaveType.findMany().then(async (types) => {
      const approved = await prisma.leaveRequest.findMany({
        where: {
          employeeId,
          status: 'APPROVED',
          startDate: { gte: new Date(Date.UTC(today.getFullYear(), 0, 1)) },
        },
      });
      return types.map((t) => {
        const used = approved
          .filter((a) => a.leaveTypeId === t.id)
          .reduce((sum, a) => sum + a.workingDaysCount, 0);
        return {
          id: t.id,
          name: t.name,
          quota: t.isUnpaid ? 'Unlimited' : t.annualQuota,
          used,
          remaining: t.isUnpaid ? 'Unlimited' : Math.max(0, t.annualQuota - used),
        };
      });
    }),
    prisma.leaveRequest.findMany({
      where: { employeeId },
      include: { leaveType: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.payrollItem.findFirst({
      where: {
        employeeId,
        payrollRun: { status: 'FINALIZED' },
      },
      include: { payrollRun: true },
      orderBy: { payrollRun: { createdAt: 'desc' } },
    }),
  ]);

  const presentDays = attendances.filter((a) => [ATTENDANCE_STATUS.PRESENT, ATTENDANCE_STATUS.LATE].includes(a.status)).length;
  const lateDays = attendances.filter((a) => a.status === ATTENDANCE_STATUS.LATE).length;
  const halfDays = attendances.filter((a) => a.status === ATTENDANCE_STATUS.HALF_DAY).length;

  return {
    isPersonal: true,
    month: today.getMonth() + 1,
    year: today.getFullYear(),
    stats: {
      daysPresent: presentDays,
      daysLate: lateDays,
      halfDays,
      totalTracked: attendances.length,
    },
    leaveBalances,
    recentLeaves,
    latestPayslip: latestPayslip
      ? {
          period: `${latestPayslip.payrollRun.month}/${latestPayslip.payrollRun.year}`,
          grossSalary: latestPayslip.grossSalary,
          netSalary: latestPayslip.netSalary,
          totalDeductions: latestPayslip.totalDeductions,
          payrollRunId: latestPayslip.payrollRunId,
        }
      : null,
  };
}

module.exports = {
  getDashboardMetrics,
  getEmployeePersonalDashboard,
};
