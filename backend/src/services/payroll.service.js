const prisma = require('../config/prisma');
const { PAYROLL_STATUS, ROLES, AUDIT_ACTIONS, ATTENDANCE_STATUS } = require('../config/constants');
const { getWorkingDaysInMonth, formatDateYMD } = require('../utils/dateUtils');
const { calculateEmployeeSalaryBreakdown } = require('../utils/payrollCalculator');
const { generatePayslipPDF } = require('../utils/pdfGenerator');
const { logAudit } = require('./audit.service');
const { createNotification } = require('./notification.service');

async function listPayrollRuns() {
  return await prisma.payrollRun.findMany({
    include: {
      _count: { select: { items: true } },
    },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  });
}

async function getPayrollRunById(id, requestingUser = null) {
  const run = await prisma.payrollRun.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          employee: {
            include: { department: true, designation: true },
          },
        },
      },
    },
  });

  if (!run) {
    const error = new Error('Payroll run not found');
    error.statusCode = 404;
    throw error;
  }

  // Filter items if user is EMPLOYEE: employee cannot see other employees' data or salaries!
  if (requestingUser?.role === ROLES.EMPLOYEE) {
    run.items = run.items.filter((item) => item.employeeId === requestingUser.employee?.id);
  }

  return run;
}

async function generatePayrollDraft(actor, { year, month }, req = null) {
  // Check if finalized run already exists for this year and month
  const existingRun = await prisma.payrollRun.findUnique({
    where: {
      year_month: { year, month },
    },
  });

  if (existingRun && existingRun.status === PAYROLL_STATUS.FINALIZED) {
    const error = new Error(`Payroll for ${month}/${year} is finalized and locked. It cannot be regenerated or modified.`);
    error.statusCode = 403;
    throw error;
  }

  // 1. Calculate working days in month
  const settings = await prisma.companySetting.findFirst();
  const weekendDays = (settings?.weekendDays || 'Saturday,Sunday').split(',');

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59));

  const holidays = await prisma.holiday.findMany({
    where: {
      date: { gte: monthStart, lte: monthEnd },
    },
  });
  const holidayDates = holidays.map((h) => formatDateYMD(h.date));

  const monthWorkingDaysResult = getWorkingDaysInMonth(year, month, weekendDays, holidayDates);
  const workingDaysInMonth = monthWorkingDaysResult.count;

  // 2. Eligible employees: joined on or before monthEnd and (no exitDate or exited on or after monthStart)
  const employees = await prisma.employee.findMany({
    where: {
      joiningDate: { lte: monthEnd },
      OR: [
        { exitDate: null },
        { exitDate: { gte: monthStart } },
      ],
    },
    include: { department: true, designation: true },
  });

  if (employees.length === 0) {
    const error = new Error('No eligible employees found for this payroll month.');
    error.statusCode = 400;
    throw error;
  }

  // 3. For each employee, aggregate attendance & unpaid leaves for the month
  const calculatedItems = [];

  for (const emp of employees) {
    // Attendance records
    const attendances = await prisma.attendance.findMany({
      where: {
        employeeId: emp.id,
        date: { gte: monthStart, lte: monthEnd },
      },
    });

    const presentCount = attendances.filter((a) => [ATTENDANCE_STATUS.PRESENT, ATTENDANCE_STATUS.LATE].includes(a.status)).length;
    const halfDayCount = attendances.filter((a) => a.status === ATTENDANCE_STATUS.HALF_DAY).length;
    
    // Approved unpaid leave days
    const unpaidLeaves = await prisma.leaveRequest.findMany({
      where: {
        employeeId: emp.id,
        status: 'APPROVED',
        leaveType: { isUnpaid: true },
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart },
      },
    });
    const unpaidLeaveDays = unpaidLeaves.reduce((sum, lv) => sum + lv.workingDaysCount, 0);

    // Approved paid leave days
    const paidLeaves = await prisma.leaveRequest.findMany({
      where: {
        employeeId: emp.id,
        status: 'APPROVED',
        leaveType: { isUnpaid: false },
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart },
      },
    });
    const paidLeaveDays = paidLeaves.reduce((sum, lv) => sum + lv.workingDaysCount, 0);

    // Worked days
    const workedDays = presentCount + (0.5 * halfDayCount);

    // Expected active working days in this month for this employee
    const activeStart = emp.joiningDate > monthStart ? emp.joiningDate : monthStart;
    const activeEnd = emp.exitDate && emp.exitDate < monthEnd ? emp.exitDate : monthEnd;
    const empActiveWorkingDays = getWorkingDaysInMonth(year, month, weekendDays, holidayDates); // standard base

    // Absent days calculation:
    // Any working day where employee was active but had no attendance record and no approved leave
    const totalAccountedDays = presentCount + halfDayCount + paidLeaveDays + unpaidLeaveDays;
    const absentDays = Math.max(0, workingDaysInMonth - totalAccountedDays);

    const breakdown = calculateEmployeeSalaryBreakdown({
      basicSalary: emp.basicSalary,
      workingDaysInMonth,
      workedDays,
      absentDays,
      halfDays: halfDayCount,
      unpaidLeaveDays,
      joiningDate: emp.joiningDate,
      exitDate: emp.exitDate,
      monthStartDate: monthStart,
      monthEndDate: monthEnd,
      weekendDays,
      holidayDates,
    });

    calculatedItems.push({
      employeeId: emp.id,
      ...breakdown,
    });
  }

  // 4. Upsert PayrollRun & Items in transaction
  const resultRun = await prisma.$transaction(async (tx) => {
    let run = existingRun;
    if (!run) {
      run = await tx.payrollRun.create({
        data: {
          year,
          month,
          workingDaysInMonth,
          status: PAYROLL_STATUS.DRAFT,
          totalGross: 0,
          totalDeductions: 0,
          totalNet: 0,
        },
      });
    } else {
      await tx.payrollItem.deleteMany({
        where: { payrollRunId: run.id },
      });
    }

    let runTotalGross = 0;
    let runTotalDeductions = 0;
    let runTotalNet = 0;

    for (const item of calculatedItems) {
      runTotalGross += item.grossSalary;
      runTotalDeductions += item.totalDeductions;
      runTotalNet += item.netSalary;

      await tx.payrollItem.create({
        data: {
          payrollRunId: run.id,
          employeeId: item.employeeId,
          basicSalary: item.basicSalary,
          hraAllowance: item.hraAllowance,
          medicalAllowance: item.medicalAllowance,
          grossSalary: item.grossSalary,
          perDaySalary: item.perDaySalary,
          workedDays: item.workedDays,
          absentDays: item.absentDays,
          halfDays: item.halfDays,
          unpaidLeaveDays: item.unpaidLeaveDays,
          absenteeismDeduction: item.absenteeismDeduction,
          incomeTaxDeduction: item.incomeTaxDeduction,
          otherDeductions: item.otherDeductions,
          totalDeductions: item.totalDeductions,
          netSalary: item.netSalary,
          isProrated: item.isProrated,
          prorationReason: item.prorationReason,
        },
      });
    }

    const updatedRun = await tx.payrollRun.update({
      where: { id: run.id },
      data: {
        workingDaysInMonth,
        totalGross: Number(runTotalGross.toFixed(2)),
        totalDeductions: Number(runTotalDeductions.toFixed(2)),
        totalNet: Number(runTotalNet.toFixed(2)),
      },
      include: {
        items: {
          include: {
            employee: {
              include: { department: true, designation: true },
            },
          },
        },
      },
    });

    return updatedRun;
  });

  await logAudit({
    actor,
    action: AUDIT_ACTIONS.CREATE,
    entity: 'PAYROLL_DRAFT',
    entityId: resultRun.id,
    after: { year, month, totalNet: resultRun.totalNet, itemsCount: resultRun.items.length },
    req,
  });

  return resultRun;
}

async function finalizePayroll(actor, runId, req = null) {
  const run = await prisma.payrollRun.findUnique({
    where: { id: runId },
    include: {
      items: {
        include: { employee: true },
      },
    },
  });

  if (!run) {
    const error = new Error('Payroll run not found');
    error.statusCode = 404;
    throw error;
  }

  if (run.status === PAYROLL_STATUS.FINALIZED) {
    const error = new Error('This payroll run is already finalized and locked');
    error.statusCode = 400;
    throw error;
  }

  const finalized = await prisma.payrollRun.update({
    where: { id: runId },
    data: {
      status: PAYROLL_STATUS.FINALIZED,
      finalizedByUserId: actor.id,
      finalizedAt: new Date(),
    },
  });

  await logAudit({
    actor,
    action: AUDIT_ACTIONS.FINALIZE,
    entity: 'PAYROLL_FINALIZED',
    entityId: runId,
    after: { year: run.year, month: run.month, totalNet: run.totalNet },
    req,
  });

  // Send notifications to all included employees
  for (const item of run.items) {
    await createNotification({
      userId: item.employee.userId,
      title: 'Payslip Available',
      message: `Your payslip for ${run.month}/${run.year} has been finalized. Net pay: $${item.netSalary}`,
      type: 'PAYROLL',
      link: `/payroll?month=${run.month}&year=${run.year}`,
    });
  }

  return finalized;
}

async function getEmployeePayslips(employeeId) {
  return await prisma.payrollItem.findMany({
    where: {
      employeeId,
      payrollRun: { status: PAYROLL_STATUS.FINALIZED },
    },
    include: {
      payrollRun: true,
      employee: {
        include: { department: true, designation: true },
      },
    },
    orderBy: [
      { payrollRun: { year: 'desc' } },
      { payrollRun: { month: 'desc' } },
    ],
  });
}

async function getPayslipPDFBuffer(payrollRunId, employeeId, requestingUser) {
  // Enforce access control: Employee can only see own payslip!
  if (requestingUser.role === ROLES.EMPLOYEE && requestingUser.employee?.id !== employeeId) {
    const error = new Error('Forbidden: You can only download your own payslip');
    error.statusCode = 403;
    throw error;
  }

  const run = await prisma.payrollRun.findUnique({
    where: { id: payrollRunId },
  });

  if (!run) {
    const error = new Error('Payroll run not found');
    error.statusCode = 404;
    throw error;
  }

  const item = await prisma.payrollItem.findUnique({
    where: {
      payrollRunId_employeeId: {
        payrollRunId,
        employeeId,
      },
    },
    include: {
      employee: {
        include: { department: true, designation: true },
      },
    },
  });

  if (!item) {
    const error = new Error('Payslip item not found for this employee');
    error.statusCode = 404;
    throw error;
  }

  const company = await prisma.companySetting.findFirst();

  return await generatePayslipPDF({
    companyName: company?.companyName || '',
    payrollRun: run,
    item,
    employee: item.employee,
  });
}

module.exports = {
  listPayrollRuns,
  getPayrollRunById,
  generatePayrollDraft,
  finalizePayroll,
  getEmployeePayslips,
  getPayslipPDFBuffer,
};
