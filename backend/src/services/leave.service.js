const prisma = require('../config/prisma');
const { LEAVE_STATUS, AUDIT_ACTIONS } = require('../config/constants');
const { getWorkingDaysBetween, normalizeDateOnly, formatDateYMD } = require('../utils/dateUtils');
const { logAudit } = require('./audit.service');
const { createNotification } = require('./notification.service');

async function getEmployeeLeaveBalance(employeeId, year = new Date().getFullYear()) {
  const leaveTypes = await prisma.leaveType.findMany({
    orderBy: { code: 'asc' },
  });

  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59));

  // Approved leave requests for employee in this year
  const approvedLeaves = await prisma.leaveRequest.findMany({
    where: {
      employeeId,
      status: LEAVE_STATUS.APPROVED,
      startDate: { gte: yearStart },
      endDate: { lte: yearEnd },
    },
  });

  const pendingLeaves = await prisma.leaveRequest.findMany({
    where: {
      employeeId,
      status: LEAVE_STATUS.PENDING,
      startDate: { gte: yearStart },
      endDate: { lte: yearEnd },
    },
  });

  const balances = leaveTypes.map((lt) => {
    const usedDays = approvedLeaves
      .filter((lv) => lv.leaveTypeId === lt.id)
      .reduce((sum, lv) => sum + lv.workingDaysCount, 0);

    const pendingDays = pendingLeaves
      .filter((lv) => lv.leaveTypeId === lt.id)
      .reduce((sum, lv) => sum + lv.workingDaysCount, 0);

    const quota = lt.isUnpaid ? Infinity : lt.annualQuota;
    const remainingDays = lt.isUnpaid ? Infinity : Math.max(0, lt.annualQuota - usedDays);

    return {
      leaveTypeId: lt.id,
      name: lt.name,
      code: lt.code,
      annualQuota: lt.isUnpaid ? 'Unlimited' : lt.annualQuota,
      usedDays,
      pendingDays,
      remainingDays: lt.isUnpaid ? 'Unlimited' : remainingDays,
      isUnpaid: lt.isUnpaid,
    };
  });

  return balances;
}

async function applyLeave(userId, { leaveTypeId, startDate, endDate, reason }, req = null) {
  const employee = await prisma.employee.findUnique({
    where: { userId },
  });

  if (!employee) {
    const error = new Error('Employee profile not found');
    error.statusCode = 404;
    throw error;
  }

  const start = normalizeDateOnly(startDate);
  const end = normalizeDateOnly(endDate);

  if (start > end) {
    const error = new Error('Start date must be before or equal to end date');
    error.statusCode = 422;
    throw error;
  }

  // 1. Fetch company settings for weekend days and holidays
  const settings = await prisma.companySetting.findFirst();
  const weekendDays = (settings?.weekendDays || 'Saturday,Sunday').split(',');

  const holidays = await prisma.holiday.findMany({
    where: {
      date: { gte: start, lte: end },
    },
  });
  const holidayDates = holidays.map((h) => formatDateYMD(h.date));

  // Compute working days count (skipping weekends & holidays)
  const workingDaysResult = getWorkingDaysBetween(start, end, weekendDays, holidayDates);
  const workingDaysCount = workingDaysResult.count;

  if (workingDaysCount <= 0) {
    const error = new Error('The selected date range does not contain any working days (weekends/holidays).');
    error.statusCode = 422;
    throw error;
  }

  // 2. Overlap check: Overlap with existing approved or pending leave returns 422
  const overlapping = await prisma.leaveRequest.findFirst({
    where: {
      employeeId: employee.id,
      status: { in: [LEAVE_STATUS.PENDING, LEAVE_STATUS.APPROVED] },
      OR: [
        { startDate: { lte: end }, endDate: { gte: start } },
      ],
    },
    include: { leaveType: true },
  });

  if (overlapping) {
    const error = new Error(
      `Overlap detected: You already have a ${overlapping.status.toLowerCase()} ${overlapping.leaveType.name} from ${formatDateYMD(overlapping.startDate)} to ${formatDateYMD(overlapping.endDate)}.`
    );
    error.statusCode = 422;
    throw error;
  }

  // 3. Balance check: Over-balance returns 422
  const leaveType = await prisma.leaveType.findUnique({
    where: { id: leaveTypeId },
  });

  if (!leaveType) {
    const error = new Error('Leave type not found');
    error.statusCode = 404;
    throw error;
  }

  if (!leaveType.isUnpaid) {
    const currentYear = start.getUTCFullYear();
    const balances = await getEmployeeLeaveBalance(employee.id, currentYear);
    const typeBalance = balances.find((b) => b.leaveTypeId === leaveTypeId);

    if (typeBalance && typeof typeBalance.remainingDays === 'number') {
      if (workingDaysCount > typeBalance.remainingDays) {
        const error = new Error(
          `Over-balance: You requested ${workingDaysCount} working days, but only have ${typeBalance.remainingDays} days remaining for ${leaveType.name}.`
        );
        error.statusCode = 422;
        throw error;
      }
    }
  }

  const leaveRequest = await prisma.leaveRequest.create({
    data: {
      employeeId: employee.id,
      leaveTypeId,
      startDate: start,
      endDate: end,
      workingDaysCount,
      reason: reason.trim(),
      status: LEAVE_STATUS.PENDING,
    },
    include: { leaveType: true },
  });

  await logAudit({
    actor: { id: userId, email: employee.email, role: 'EMPLOYEE' },
    action: AUDIT_ACTIONS.CREATE,
    entity: 'LEAVE_REQUEST',
    entityId: leaveRequest.id,
    after: {
      leaveType: leaveType.name,
      workingDaysCount,
      startDate: formatDateYMD(start),
      endDate: formatDateYMD(end),
    },
    req,
  });

  return leaveRequest;
}

async function cancelLeave(userId, leaveRequestId, req = null) {
  const employee = await prisma.employee.findUnique({
    where: { userId },
  });

  if (!employee) {
    const error = new Error('Employee profile not found');
    error.statusCode = 404;
    throw error;
  }

  const leave = await prisma.leaveRequest.findUnique({
    where: { id: leaveRequestId },
  });

  if (!leave || leave.employeeId !== employee.id) {
    const error = new Error('Leave request not found');
    error.statusCode = 404;
    throw error;
  }

  if (leave.status !== LEAVE_STATUS.PENDING) {
    const error = new Error(`Cannot cancel a leave request that is already ${leave.status.toLowerCase()}`);
    error.statusCode = 400;
    throw error;
  }

  const updated = await prisma.leaveRequest.update({
    where: { id: leaveRequestId },
    data: { status: LEAVE_STATUS.CANCELLED },
  });

  await logAudit({
    actor: { id: userId, email: employee.email, role: 'EMPLOYEE' },
    action: AUDIT_ACTIONS.UPDATE,
    entity: 'LEAVE_CANCEL',
    entityId: leaveRequestId,
    after: { status: LEAVE_STATUS.CANCELLED },
    req,
  });

  return updated;
}

async function listLeaveRequests({ status, departmentId, employeeId, page = 1, limit = 50 }) {
  const where = {};
  if (status) where.status = status;
  if (employeeId) where.employeeId = employeeId;
  if (departmentId) where.employee = { departmentId };

  const skip = (page - 1) * limit;

  const [total, requests] = await Promise.all([
    prisma.leaveRequest.count({ where }),
    prisma.leaveRequest.findMany({
      where,
      include: {
        leaveType: true,
        employee: {
          include: { department: true, designation: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    requests,
  };
}

async function reviewLeaveRequest(actor, leaveRequestId, { status, reviewerComment = null }, req = null) {
  const leave = await prisma.leaveRequest.findUnique({
    where: { id: leaveRequestId },
    include: {
      leaveType: true,
      employee: { include: { user: true } },
    },
  });

  if (!leave) {
    const error = new Error('Leave request not found');
    error.statusCode = 404;
    throw error;
  }

  if (leave.status !== LEAVE_STATUS.PENDING) {
    const error = new Error('This leave request has already been reviewed');
    error.statusCode = 400;
    throw error;
  }

  const updated = await prisma.leaveRequest.update({
    where: { id: leaveRequestId },
    data: {
      status,
      reviewerId: actor.id,
      reviewerComment,
      reviewedAt: new Date(),
    },
    include: { leaveType: true },
  });

  await logAudit({
    actor,
    action: status === LEAVE_STATUS.APPROVED ? AUDIT_ACTIONS.APPROVE : AUDIT_ACTIONS.REJECT,
    entity: 'LEAVE_REVIEW',
    entityId: leaveRequestId,
    before: { status: leave.status },
    after: { status, reviewerComment },
    req,
  });

  // Send Notification to Employee
  await createNotification({
    userId: leave.employee.userId,
    title: `Leave Request ${status}`,
    message: `Your ${leave.leaveType.name} request for ${formatDateYMD(leave.startDate)} to ${formatDateYMD(leave.endDate)} was ${status.toLowerCase()}.${reviewerComment ? ` Comment: ${reviewerComment}` : ''}`,
    type: 'LEAVE',
  });

  return updated;
}

module.exports = {
  getEmployeeLeaveBalance,
  applyLeave,
  cancelLeave,
  listLeaveRequests,
  reviewLeaveRequest,
};
