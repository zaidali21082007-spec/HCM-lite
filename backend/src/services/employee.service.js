const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const { ROLES, AUDIT_ACTIONS } = require('../config/constants');
const { logAudit } = require('./audit.service');

async function registerEmployee(actor, data, req = null) {
  const {
    employeeCode,
    firstName,
    lastName,
    email,
    departmentId,
    designationId,
    joiningDate,
    basicSalary,
    phone = null,
    address = null,
    dateOfBirth = null,
    temporaryPassword = 'TempPassword123!',
  } = data;

  const normalizedEmail = email.toLowerCase().trim();
  const normalizedCode = employeeCode.trim().toUpperCase();

  // 1. Verify unique employeeCode and email
  const existingEmail = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existingEmail) {
    const error = new Error(`An account with email '${normalizedEmail}' already exists`);
    error.statusCode = 409;
    throw error;
  }

  const existingCode = await prisma.employee.findUnique({ where: { employeeCode: normalizedCode } });
  if (existingCode) {
    const error = new Error(`An employee with code '${normalizedCode}' already exists`);
    error.statusCode = 409;
    throw error;
  }

  // 2. Validate known department and designation
  const department = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!department) {
    const error = new Error('Selected department does not exist');
    error.statusCode = 400;
    throw error;
  }

  const designation = await prisma.designation.findUnique({ where: { id: designationId } });
  if (!designation) {
    const error = new Error('Selected designation does not exist');
    error.statusCode = 400;
    throw error;
  }

  if (Number(basicSalary) <= 0) {
    const error = new Error('Basic salary must be greater than 0');
    error.statusCode = 400;
    throw error;
  }

  const passwordHash = await bcrypt.hash(temporaryPassword, 10);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        role: ROLES.EMPLOYEE,
        isTemporaryPassword: true,
        isActive: true,
      },
    });

    const allowances = Number((Number(basicSalary) * 0.5).toFixed(2)); // HRA 40% + Medical 10%

    const employee = await tx.employee.create({
      data: {
        employeeCode: normalizedCode,
        userId: user.id,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: normalizedEmail,
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        joiningDate: new Date(joiningDate),
        basicSalary: Number(basicSalary),
        allowances,
        departmentId,
        designationId,
        status: 'ACTIVE',
      },
      include: {
        department: true,
        designation: true,
      },
    });

    return { user, employee };
  });

  await logAudit({
    actor,
    action: AUDIT_ACTIONS.CREATE,
    entity: 'EMPLOYEE',
    entityId: result.employee.id,
    after: {
      employeeCode: result.employee.employeeCode,
      email: result.employee.email,
      department: department.name,
      basicSalary: result.employee.basicSalary,
    },
    req,
  });

  return {
    employee: result.employee,
    temporaryCredentials: {
      email: normalizedEmail,
      temporaryPassword,
    },
  };
}

async function listEmployees({ departmentId, status, search, page = 1, limit = 50 }) {
  const where = {};
  if (departmentId) where.departmentId = departmentId;
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { firstName: { contains: search } },
      { lastName: { contains: search } },
      { employeeCode: { contains: search } },
      { email: { contains: search } },
    ];
  }

  const skip = (page - 1) * limit;

  const [total, employees] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      include: {
        department: true,
        designation: true,
        user: {
          select: { id: true, email: true, role: true, isActive: true, isTemporaryPassword: true },
        },
      },
      orderBy: { employeeCode: 'asc' },
      skip,
      take: limit,
    }),
  ]);

  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    employees,
  };
}

async function getEmployeeById(id, requestingUser) {
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      department: true,
      designation: true,
      user: {
        select: { id: true, email: true, role: true, isActive: true },
      },
    },
  });

  if (!employee) {
    const error = new Error('Employee not found');
    error.statusCode = 404;
    throw error;
  }

  // Role check: Employee cannot see other employees' data or salaries
  if (requestingUser.role === ROLES.EMPLOYEE && requestingUser.employee?.id !== id) {
    const error = new Error('Access denied: You can only view your own profile');
    error.statusCode = 403;
    throw error;
  }

  return employee;
}

async function updateEmployeeDetails(actor, id, data, req = null) {
  const current = await prisma.employee.findUnique({
    where: { id },
    include: { department: true, designation: true },
  });

  if (!current) {
    const error = new Error('Employee not found');
    error.statusCode = 404;
    throw error;
  }

  const updatePayload = {};
  if (data.firstName) updatePayload.firstName = data.firstName.trim();
  if (data.lastName) updatePayload.lastName = data.lastName.trim();
  if (data.phone !== undefined) updatePayload.phone = data.phone;
  if (data.address !== undefined) updatePayload.address = data.address;
  if (data.departmentId) updatePayload.departmentId = data.departmentId;
  if (data.designationId) updatePayload.designationId = data.designationId;
  if (data.status) updatePayload.status = data.status;
  if (data.exitDate !== undefined) updatePayload.exitDate = data.exitDate ? new Date(data.exitDate) : null;

  if (data.basicSalary != null) {
    const sal = Number(data.basicSalary);
    if (sal <= 0) {
      const error = new Error('Salary must be greater than 0');
      error.statusCode = 400;
      throw error;
    }
    updatePayload.basicSalary = sal;
    updatePayload.allowances = Number((sal * 0.5).toFixed(2));
  }

  const updated = await prisma.employee.update({
    where: { id },
    data: updatePayload,
    include: { department: true, designation: true },
  });

  await logAudit({
    actor,
    action: AUDIT_ACTIONS.UPDATE,
    entity: 'EMPLOYEE',
    entityId: id,
    before: {
      firstName: current.firstName,
      lastName: current.lastName,
      basicSalary: current.basicSalary,
      status: current.status,
    },
    after: {
      firstName: updated.firstName,
      lastName: updated.lastName,
      basicSalary: updated.basicSalary,
      status: updated.status,
    },
    req,
  });

  return updated;
}

async function updateEmployeeSelfProfile(userId, { phone, address }, req = null) {
  const employee = await prisma.employee.findUnique({
    where: { userId },
  });

  if (!employee) {
    const error = new Error('Employee profile not found');
    error.statusCode = 404;
    throw error;
  }

  const updated = await prisma.employee.update({
    where: { id: employee.id },
    data: {
      phone: phone !== undefined ? phone : employee.phone,
      address: address !== undefined ? address : employee.address,
    },
  });

  await logAudit({
    actor: { id: userId, email: employee.email, role: ROLES.EMPLOYEE },
    action: AUDIT_ACTIONS.UPDATE,
    entity: 'EMPLOYEE_SELF_PROFILE',
    entityId: employee.id,
    before: { phone: employee.phone, address: employee.address },
    after: { phone: updated.phone, address: updated.address },
    req,
  });

  return updated;
}

/**
 * CSV Import Dry Run: returns valid rows, invalid rows with row + field + reason
 */
async function dryRunCsvImport(rows) {
  const departments = await prisma.department.findMany();
  const designations = await prisma.designation.findMany();
  const existingCodes = new Set((await prisma.employee.findMany({ select: { employeeCode: true } })).map((e) => e.employeeCode.toUpperCase()));
  const existingEmails = new Set((await prisma.user.findMany({ select: { email: true } })).map((u) => u.email.toLowerCase()));

  const deptMapByNameOrCode = new Map();
  departments.forEach((d) => {
    deptMapByNameOrCode.set(d.name.toLowerCase(), d.id);
    deptMapByNameOrCode.set(d.code.toLowerCase(), d.id);
  });

  const desMapByTitle = new Map();
  designations.forEach((d) => {
    desMapByTitle.set(d.title.toLowerCase(), d.id);
  });

  const errors = [];
  const validRows = [];

  const seenBatchCodes = new Set();
  const seenBatchEmails = new Set();

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const rowNum = index + 1; // 1-indexed for user readability
    const rowErrors = [];

    const code = row.employeeCode?.toString().trim().toUpperCase();
    const email = row.email?.toString().trim().toLowerCase();
    const firstName = row.firstName?.toString().trim();
    const lastName = row.lastName?.toString().trim();
    const deptInput = row.department?.toString().trim().toLowerCase();
    const desInput = row.designation?.toString().trim().toLowerCase();
    const joiningDate = row.joiningDate?.toString().trim();
    const basicSalary = Number(row.basicSalary);

    // Required fields check
    if (!code) rowErrors.push({ row: rowNum, field: 'employeeCode', reason: 'Employee code is required' });
    if (!email) rowErrors.push({ row: rowNum, field: 'email', reason: 'Email is required' });
    if (!firstName) rowErrors.push({ row: rowNum, field: 'firstName', reason: 'First name is required' });
    if (!lastName) rowErrors.push({ row: rowNum, field: 'lastName', reason: 'Last name is required' });
    if (!joiningDate) rowErrors.push({ row: rowNum, field: 'joiningDate', reason: 'Joining date is required' });

    // Valid email check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email)) {
      rowErrors.push({ row: rowNum, field: 'email', reason: 'Invalid email format' });
    }

    // Unique code check
    if (code) {
      if (existingCodes.has(code) || seenBatchCodes.has(code)) {
        rowErrors.push({ row: rowNum, field: 'employeeCode', reason: `Employee code '${code}' already exists` });
      }
    }

    // Unique email check
    if (email) {
      if (existingEmails.has(email) || seenBatchEmails.has(email)) {
        rowErrors.push({ row: rowNum, field: 'email', reason: `Email '${email}' already exists` });
      }
    }

    // Known department check
    const departmentId = deptInput ? deptMapByNameOrCode.get(deptInput) : null;
    if (!departmentId) {
      rowErrors.push({ row: rowNum, field: 'department', reason: `Unknown department '${row.department || ''}'` });
    }

    // Known designation check
    const designationId = desInput ? desMapByTitle.get(desInput) : null;
    if (!designationId) {
      rowErrors.push({ row: rowNum, field: 'designation', reason: `Unknown designation '${row.designation || ''}'` });
    }

    // ISO Date check
    if (joiningDate && isNaN(Date.parse(joiningDate))) {
      rowErrors.push({ row: rowNum, field: 'joiningDate', reason: 'Invalid ISO date format for joining date' });
    }

    // Salary > 0 check
    if (isNaN(basicSalary) || basicSalary <= 0) {
      rowErrors.push({ row: rowNum, field: 'basicSalary', reason: 'Salary must be a positive number greater than 0' });
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
    } else {
      seenBatchCodes.add(code);
      seenBatchEmails.add(email);
      validRows.push({
        employeeCode: code,
        email,
        firstName,
        lastName,
        departmentId,
        designationId,
        joiningDate: new Date(joiningDate),
        basicSalary,
        phone: row.phone?.toString().trim() || null,
        address: row.address?.toString().trim() || null,
      });
    }
  }

  return {
    totalRows: rows.length,
    validCount: validRows.length,
    invalidCount: errors.length > 0 ? (new Set(errors.map((e) => e.row))).size : 0,
    errors,
    validRows,
  };
}

/**
 * Commit CSV Import
 */
async function commitCsvImport(actor, rows, req = null) {
  const dryRun = await dryRunCsvImport(rows);
  if (dryRun.errors.length > 0) {
    const error = new Error('CSV validation failed. Please fix errors before importing.');
    error.statusCode = 422;
    error.errors = dryRun.errors;
    throw error;
  }

  const defaultPasswordHash = await bcrypt.hash('Welcome123!', 10);
  const createdEmployees = [];

  await prisma.$transaction(async (tx) => {
    for (const item of dryRun.validRows) {
      const user = await tx.user.create({
        data: {
          email: item.email,
          passwordHash: defaultPasswordHash,
          role: ROLES.EMPLOYEE,
          isTemporaryPassword: true,
          isActive: true,
        },
      });

      const allowances = Number((item.basicSalary * 0.5).toFixed(2));

      const emp = await tx.employee.create({
        data: {
          employeeCode: item.employeeCode,
          userId: user.id,
          firstName: item.firstName,
          lastName: item.lastName,
          email: item.email,
          phone: item.phone,
          address: item.address,
          joiningDate: item.joiningDate,
          basicSalary: item.basicSalary,
          allowances,
          departmentId: item.departmentId,
          designationId: item.designationId,
          status: 'ACTIVE',
        },
      });

      createdEmployees.push(emp);
    }
  });

  await logAudit({
    actor,
    action: AUDIT_ACTIONS.IMPORT,
    entity: 'EMPLOYEES_CSV',
    after: { count: createdEmployees.length },
    req,
  });

  return {
    importedCount: createdEmployees.length,
    defaultTemporaryPassword: 'Welcome123!',
  };
}

/**
 * CSV Export formatted data
 */
async function exportEmployeesCsv() {
  const employees = await prisma.employee.findMany({
    include: { department: true, designation: true },
    orderBy: { employeeCode: 'asc' },
  });

  const headers = 'employeeCode,firstName,lastName,email,phone,department,designation,joiningDate,basicSalary,status\n';
  const rows = employees
    .map((e) =>
      [
        e.employeeCode,
        `"${e.firstName}"`,
        `"${e.lastName}"`,
        e.email,
        e.phone || '',
        `"${e.department.name}"`,
        `"${e.designation.title}"`,
        e.joiningDate.toISOString().substring(0, 10),
        e.basicSalary,
        e.status,
      ].join(',')
    )
    .join('\n');

  return headers + rows;
}

module.exports = {
  registerEmployee,
  listEmployees,
  getEmployeeById,
  updateEmployeeDetails,
  updateEmployeeSelfProfile,
  dryRunCsvImport,
  commitCsvImport,
  exportEmployeesCsv,
};
