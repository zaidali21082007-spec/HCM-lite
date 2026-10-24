const prisma = require('../config/prisma');
const { AUDIT_ACTIONS } = require('../config/constants');
const { logAudit } = require('./audit.service');

async function getCompanySettings() {
  let settings = await prisma.companySetting.findFirst();
  if (!settings) {
    settings = await prisma.companySetting.create({
      data: {
        companyName: '',
        officeStartTime: '09:00',
        officeEndTime: '18:00',
        graceMinutes: 15,
        halfDayHours: 5.0,
        weekendDays: 'Saturday,Sunday',
        setupCompleted: false,
      },
    });
  }
  return settings;
}

async function updateCompanySettings(actor, data, req = null) {
  const current = await getCompanySettings();

  const updated = await prisma.companySetting.update({
    where: { id: current.id },
    data,
  });

  await logAudit({
    actor,
    action: AUDIT_ACTIONS.UPDATE,
    entity: 'COMPANY_SETTINGS',
    entityId: updated.id,
    before: current,
    after: updated,
    req,
  });

  return updated;
}

// Departments
async function getDepartments() {
  return await prisma.department.findMany({
    include: {
      _count: {
        select: { employees: true },
      },
    },
    orderBy: { name: 'asc' },
  });
}

async function createDepartment(actor, data, req = null) {
  const dept = await prisma.department.create({
    data: {
      name: data.name.trim(),
      code: data.code.trim().toUpperCase(),
      description: data.description?.trim() || null,
    },
  });

  await logAudit({
    actor,
    action: AUDIT_ACTIONS.CREATE,
    entity: 'DEPARTMENT',
    entityId: dept.id,
    after: dept,
    req,
  });

  return dept;
}

async function deleteDepartment(actor, id, req = null) {
  const count = await prisma.employee.count({ where: { departmentId: id } });
  if (count > 0) {
    const error = new Error(`Cannot delete department with ${count} assigned employees.`);
    error.statusCode = 400;
    throw error;
  }

  const deleted = await prisma.department.delete({ where: { id } });

  await logAudit({
    actor,
    action: AUDIT_ACTIONS.DELETE,
    entity: 'DEPARTMENT',
    entityId: id,
    before: deleted,
    req,
  });

  return deleted;
}

// Designations
async function getDesignations() {
  return await prisma.designation.findMany({
    include: {
      _count: {
        select: { employees: true },
      },
    },
    orderBy: { title: 'asc' },
  });
}

async function createDesignation(actor, data, req = null) {
  const des = await prisma.designation.create({
    data: {
      title: data.title.trim(),
      description: data.description?.trim() || null,
    },
  });

  await logAudit({
    actor,
    action: AUDIT_ACTIONS.CREATE,
    entity: 'DESIGNATION',
    entityId: des.id,
    after: des,
    req,
  });

  return des;
}

async function deleteDesignation(actor, id, req = null) {
  const count = await prisma.employee.count({ where: { designationId: id } });
  if (count > 0) {
    const error = new Error(`Cannot delete designation with ${count} assigned employees.`);
    error.statusCode = 400;
    throw error;
  }

  const deleted = await prisma.designation.delete({ where: { id } });

  await logAudit({
    actor,
    action: AUDIT_ACTIONS.DELETE,
    entity: 'DESIGNATION',
    entityId: id,
    before: deleted,
    req,
  });

  return deleted;
}

// Leave Types
async function getLeaveTypes() {
  return await prisma.leaveType.findMany({
    orderBy: { name: 'asc' },
  });
}

async function createLeaveType(actor, data, req = null) {
  const lt = await prisma.leaveType.create({
    data: {
      name: data.name.trim(),
      code: data.code.trim().toUpperCase(),
      annualQuota: Number(data.annualQuota) || 0,
      isUnpaid: Boolean(data.isUnpaid),
      description: data.description?.trim() || null,
    },
  });

  await logAudit({
    actor,
    action: AUDIT_ACTIONS.CREATE,
    entity: 'LEAVE_TYPE',
    entityId: lt.id,
    after: lt,
    req,
  });

  return lt;
}

async function updateLeaveType(actor, id, data, req = null) {
  const before = await prisma.leaveType.findUnique({ where: { id } });
  const updated = await prisma.leaveType.update({
    where: { id },
    data,
  });

  await logAudit({
    actor,
    action: AUDIT_ACTIONS.UPDATE,
    entity: 'LEAVE_TYPE',
    entityId: id,
    before,
    after: updated,
    req,
  });

  return updated;
}

// Holidays
async function getHolidays(year = null) {
  const where = {};
  if (year) {
    const startDate = new Date(Date.UTC(year, 0, 1));
    const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59));
    where.date = { gte: startDate, lte: endDate };
  }
  return await prisma.holiday.findMany({
    where,
    orderBy: { date: 'asc' },
  });
}

async function createHoliday(actor, data, req = null) {
  const d = new Date(data.date);
  const normalizedDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

  const holiday = await prisma.holiday.create({
    data: {
      name: data.name.trim(),
      date: normalizedDate,
      description: data.description?.trim() || null,
    },
  });

  await logAudit({
    actor,
    action: AUDIT_ACTIONS.CREATE,
    entity: 'HOLIDAY',
    entityId: holiday.id,
    after: holiday,
    req,
  });

  return holiday;
}

async function deleteHoliday(actor, id, req = null) {
  const deleted = await prisma.holiday.delete({ where: { id } });

  await logAudit({
    actor,
    action: AUDIT_ACTIONS.DELETE,
    entity: 'HOLIDAY',
    entityId: id,
    before: deleted,
    req,
  });

  return deleted;
}

module.exports = {
  getCompanySettings,
  updateCompanySettings,
  getDepartments,
  createDepartment,
  deleteDepartment,
  getDesignations,
  createDesignation,
  deleteDesignation,
  getLeaveTypes,
  createLeaveType,
  updateLeaveType,
  getHolidays,
  createHoliday,
  deleteHoliday,
};
