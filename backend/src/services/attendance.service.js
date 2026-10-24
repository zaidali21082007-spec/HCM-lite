const prisma = require('../config/prisma');
const { ATTENDANCE_STATUS, CORRECTION_STATUS, AUDIT_ACTIONS } = require('../config/constants');
const { normalizeDateOnly, isTimeLate, calculateDistanceMeters } = require('../utils/dateUtils');
const { logAudit } = require('./audit.service');
const { createNotification } = require('./notification.service');

const geolib = require('geolib');

async function checkIn(userId, { lat = null, lng = null, latitude = null, longitude = null, accuracy = null, source = 'camera' } = {}, req = null) {
  const employee = await prisma.employee.findUnique({
    where: { userId },
  });

  if (!employee) {
    const error = new Error('Employee profile not found for this user account');
    error.statusCode = 404;
    throw error;
  }

  // 1. Server stamps time - ignore any client timestamp
  const now = new Date();
  const todayNormalized = normalizeDateOnly(now);

  // 2. One record per employee per day (second check-in returns 409)
  const existingRecord = await prisma.attendance.findUnique({
    where: {
      employeeId_date: {
        employeeId: employee.id,
        date: todayNormalized,
      },
    },
  });

  if (existingRecord) {
    const error = new Error('Attendance check-in already recorded for today');
    error.statusCode = 409;
    throw error;
  }

  // 3. Accuracy check: 422 if accuracy > 100 m
  const actualLat = latitude ?? lat ?? null;
  const actualLng = longitude ?? lng ?? null;
  const accNum = accuracy != null ? Number(accuracy) : null;

  if (accNum != null && accNum > 100) {
    const error = new Error(`Location accuracy is too low (${Math.round(accNum)}m). Accuracy must be 100m or better.`);
    error.statusCode = 422;
    throw error;
  }

  // Read current company settings for office hours & grace time & geofence
  const settings = await prisma.companySetting.findFirst();
  const officeStartTime = settings?.officeStartTime || '09:00';
  const graceMinutes = settings?.graceMinutes ?? 15;

  // Determine status (Late after officeStartTime + graceMinutes, e.g. 09:15)
  const isLate = isTimeLate(now, officeStartTime, graceMinutes);
  const status = isLate ? ATTENDANCE_STATUS.LATE : ATTENDANCE_STATUS.PRESENT;

  // 4. Geofence check using geolib:
  // If office lat/lng are empty, skip geofence and record a note. Otherwise check isPointWithinRadius; reject with 422 if outside.
  let isGeofenceValid = true;
  let remarks = null;
  let distanceMeters = null;

  const hasOfficeCoords = settings?.officeLatitude != null && settings?.officeLongitude != null;

  if (!hasOfficeCoords) {
    isGeofenceValid = true;
    remarks = 'Geofence check skipped (office coordinates not configured)';
  } else {
    if (actualLat == null || actualLng == null) {
      const error = new Error('GPS coordinates are required when office geofence is configured');
      error.statusCode = 422;
      throw error;
    }

    const officePoint = {
      latitude: Number(settings.officeLatitude),
      longitude: Number(settings.officeLongitude),
    };
    const userPoint = {
      latitude: Number(actualLat),
      longitude: Number(actualLng),
    };

    const allowedRadius = Number(settings.officeRadiusMeters) || 500;
    distanceMeters = geolib.getDistance(userPoint, officePoint);
    const withinRadius = geolib.isPointWithinRadius(userPoint, officePoint, allowedRadius);

    if (!withinRadius) {
      const error = new Error(`Check-in rejected: Location is outside allowed office radius (${distanceMeters}m away, allowed: ${allowedRadius}m)`);
      error.statusCode = 422;
      error.distanceMeters = distanceMeters;
      throw error;
    }

    isGeofenceValid = true;
    remarks = `Office geofence verified (${distanceMeters}m from office)`;
  }

  // 5. Store record (no photo)
  const attendance = await prisma.attendance.create({
    data: {
      employeeId: employee.id,
      date: todayNormalized,
      checkIn: now,
      checkInAt: now,
      source: source || 'camera',
      latitude: actualLat != null ? Number(actualLat) : null,
      longitude: actualLng != null ? Number(actualLng) : null,
      accuracy: accNum,
      distanceMeters,
      checkInLat: actualLat != null ? Number(actualLat) : null,
      checkInLng: actualLng != null ? Number(actualLng) : null,
      status,
      isGeofenceValid,
      remarks,
    },
  });

  // 6. Audit log entry on check-in
  await logAudit({
    actor: { id: userId, email: employee.email, role: 'EMPLOYEE' },
    action: AUDIT_ACTIONS.CREATE,
    entity: 'ATTENDANCE_CHECKIN',
    entityId: attendance.id,
    after: { time: now.toISOString(), status, source, distanceMeters, isGeofenceValid },
    req,
  });

  return attendance;
}

async function checkOut(userId, { lat = null, lng = null }, req = null) {
  const employee = await prisma.employee.findUnique({
    where: { userId },
  });

  if (!employee) {
    const error = new Error('Employee profile not found');
    error.statusCode = 404;
    throw error;
  }

  const now = new Date();
  const todayNormalized = normalizeDateOnly(now);

  const record = await prisma.attendance.findUnique({
    where: {
      employeeId_date: {
        employeeId: employee.id,
        date: todayNormalized,
      },
    },
  });

  if (!record) {
    const error = new Error('No check-in record found for today. Please check in first.');
    error.statusCode = 400;
    throw error;
  }

  // Calculate work hours
  const checkInTime = new Date(record.checkIn);
  const diffHours = (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
  const workHours = Number(Math.max(0, diffHours).toFixed(2));

  // Settings for half day hours (default under 5 hours)
  const settings = await prisma.companySetting.findFirst();
  const halfDayHours = settings?.halfDayHours || 5.0;

  let finalStatus = record.status;
  if (workHours < halfDayHours) {
    finalStatus = ATTENDANCE_STATUS.HALF_DAY;
  }

  const updated = await prisma.attendance.update({
    where: { id: record.id },
    data: {
      checkOut: now,
      checkOutLat: lat ? Number(lat) : null,
      checkOutLng: lng ? Number(lng) : null,
      workHours,
      status: finalStatus,
    },
  });

  await logAudit({
    actor: { id: userId, email: employee.email, role: 'EMPLOYEE' },
    action: AUDIT_ACTIONS.UPDATE,
    entity: 'ATTENDANCE_CHECKOUT',
    entityId: record.id,
    after: { checkOut: now.toISOString(), workHours, status: finalStatus },
    req,
  });

  return updated;
}

async function getDailyAttendanceBoard(dateString, departmentId = null) {
  const targetDate = dateString ? new Date(dateString) : new Date();
  const normalizedDate = normalizeDateOnly(targetDate);

  const empWhere = { status: 'ACTIVE' };
  if (departmentId) empWhere.departmentId = departmentId;

  const employees = await prisma.employee.findMany({
    where: empWhere,
    include: { department: true, designation: true },
    orderBy: { firstName: 'asc' },
  });

  const attendanceRecords = await prisma.attendance.findMany({
    where: { date: normalizedDate },
  });
  const attMap = new Map();
  attendanceRecords.forEach((att) => attMap.set(att.employeeId, att));

  // Check approved leaves for that day
  const approvedLeaves = await prisma.leaveRequest.findMany({
    where: {
      status: 'APPROVED',
      startDate: { lte: normalizedDate },
      endDate: { gte: normalizedDate },
    },
    include: { leaveType: true },
  });
  const leaveMap = new Map();
  approvedLeaves.forEach((lv) => leaveMap.set(lv.employeeId, lv));

  const isToday = normalizedDate.getTime() === normalizeDateOnly(new Date()).getTime();

  const board = employees.map((emp) => {
    const att = attMap.get(emp.id);
    const leave = leaveMap.get(emp.id);

    let displayStatus = 'ABSENT';
    let checkIn = null;
    let checkOut = null;
    let workHours = null;

    if (att) {
      checkIn = att.checkIn;
      checkOut = att.checkOut;
      workHours = att.workHours;
      displayStatus = att.status;

      // If day is past and employee never checked out, mark missing_checkout
      if (!isToday && !att.checkOut && att.status !== ATTENDANCE_STATUS.HALF_DAY) {
        displayStatus = ATTENDANCE_STATUS.MISSING_CHECKOUT;
      }
    } else if (leave) {
      displayStatus = `ON_LEAVE (${leave.leaveType.name})`;
    } else if (isToday) {
      displayStatus = 'PENDING';
    }

    return {
      employeeId: emp.id,
      employeeCode: emp.employeeCode,
      name: `${emp.firstName} ${emp.lastName}`,
      department: emp.department.name,
      designation: emp.designation.title,
      status: displayStatus,
      checkIn,
      checkOut,
      workHours,
      attendanceId: att?.id || null,
      isGeofenceValid: att?.isGeofenceValid ?? true,
      remarks: att?.remarks || null,
    };
  });

  return {
    date: normalizedDate.toISOString().substring(0, 10),
    totalEmployees: employees.length,
    presentCount: board.filter((b) => [ATTENDANCE_STATUS.PRESENT, ATTENDANCE_STATUS.LATE].includes(b.status)).length,
    lateCount: board.filter((b) => b.status === ATTENDANCE_STATUS.LATE).length,
    halfDayCount: board.filter((b) => b.status === ATTENDANCE_STATUS.HALF_DAY).length,
    absentCount: board.filter((b) => b.status === 'ABSENT').length,
    leaveCount: board.filter((b) => b.status.startsWith('ON_LEAVE')).length,
    board,
  };
}

async function getEmployeeAttendance(employeeId, year, month) {
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59));

  return await prisma.attendance.findMany({
    where: {
      employeeId,
      date: { gte: startDate, lte: endDate },
    },
    orderBy: { date: 'asc' },
  });
}

// Attendance Corrections
async function requestCorrection(userId, { attendanceDate, requestedCheckIn, requestedCheckOut, reason }, req = null) {
  const employee = await prisma.employee.findUnique({
    where: { userId },
  });

  if (!employee) {
    const error = new Error('Employee profile not found');
    error.statusCode = 404;
    throw error;
  }

  const attDate = normalizeDateOnly(new Date(attendanceDate));

  const correction = await prisma.attendanceCorrection.create({
    data: {
      employeeId: employee.id,
      attendanceDate: attDate,
      requestedCheckIn: new Date(requestedCheckIn),
      requestedCheckOut: new Date(requestedCheckOut),
      reason: reason.trim(),
      status: CORRECTION_STATUS.PENDING,
    },
  });

  await logAudit({
    actor: { id: userId, email: employee.email, role: 'EMPLOYEE' },
    action: AUDIT_ACTIONS.CREATE,
    entity: 'ATTENDANCE_CORRECTION',
    entityId: correction.id,
    after: { attendanceDate: attDate.toISOString(), reason },
    req,
  });

  return correction;
}

async function listPendingCorrections(departmentId = null) {
  const where = { status: CORRECTION_STATUS.PENDING };
  if (departmentId) {
    where.employee = { departmentId };
  }

  return await prisma.attendanceCorrection.findMany({
    where,
    include: {
      employee: {
        include: { department: true, designation: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function reviewCorrection(actor, correctionId, { status, reviewerComment = null }, req = null) {
  const correction = await prisma.attendanceCorrection.findUnique({
    where: { id: correctionId },
    include: { employee: { include: { user: true } } },
  });

  if (!correction) {
    const error = new Error('Correction request not found');
    error.statusCode = 404;
    throw error;
  }

  if (correction.status !== CORRECTION_STATUS.PENDING) {
    const error = new Error('This correction request has already been reviewed');
    error.statusCode = 400;
    throw error;
  }

  const updatedCorrection = await prisma.$transaction(async (tx) => {
    const reviewed = await tx.attendanceCorrection.update({
      where: { id: correctionId },
      data: {
        status,
        reviewerId: actor.id,
        reviewerComment,
        reviewedAt: new Date(),
      },
    });

    // If APPROVED, update or upsert attendance record
    if (status === CORRECTION_STATUS.APPROVED) {
      const checkInTime = new Date(correction.requestedCheckIn);
      const checkOutTime = new Date(correction.requestedCheckOut);
      const diffHours = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
      const workHours = Number(Math.max(0, diffHours).toFixed(2));

      const settings = await tx.companySetting.findFirst();
      const halfDayHours = settings?.halfDayHours || 5.0;
      const officeStartTime = settings?.officeStartTime || '09:00';
      const graceMinutes = settings?.graceMinutes ?? 15;

      let recordStatus = ATTENDANCE_STATUS.PRESENT;
      if (isTimeLate(checkInTime, officeStartTime, graceMinutes)) {
        recordStatus = ATTENDANCE_STATUS.LATE;
      }
      if (workHours < halfDayHours) {
        recordStatus = ATTENDANCE_STATUS.HALF_DAY;
      }

      await tx.attendance.upsert({
        where: {
          employeeId_date: {
            employeeId: correction.employeeId,
            date: correction.attendanceDate,
          },
        },
        update: {
          checkIn: checkInTime,
          checkOut: checkOutTime,
          workHours,
          status: recordStatus,
          remarks: `Corrected and approved by ${actor.email}. Comment: ${reviewerComment || 'None'}`,
        },
        create: {
          employeeId: correction.employeeId,
          date: correction.attendanceDate,
          checkIn: checkInTime,
          checkOut: checkOutTime,
          workHours,
          status: recordStatus,
          remarks: `Corrected and approved by ${actor.email}. Comment: ${reviewerComment || 'None'}`,
        },
      });
    }

    return reviewed;
  });

  await logAudit({
    actor,
    action: status === CORRECTION_STATUS.APPROVED ? AUDIT_ACTIONS.APPROVE : AUDIT_ACTIONS.REJECT,
    entity: 'ATTENDANCE_CORRECTION',
    entityId: correctionId,
    after: { status, reviewerComment },
    req,
  });

  await createNotification({
    userId: correction.employee.userId,
    title: `Attendance Correction ${status}`,
    message: `Your correction for ${correction.attendanceDate.toISOString().substring(0, 10)} was ${status.toLowerCase()}.${reviewerComment ? ` Note: ${reviewerComment}` : ''}`,
    type: 'ATTENDANCE',
  });

  return updatedCorrection;
}

module.exports = {
  checkIn,
  checkOut,
  getDailyAttendanceBoard,
  getEmployeeAttendance,
  requestCorrection,
  listPendingCorrections,
  reviewCorrection,
};
