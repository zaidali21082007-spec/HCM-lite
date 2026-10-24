const { z } = require('zod');

// ISO Date string validator (YYYY-MM-DD or full ISO 8601)
const isoDateString = z.string().refine((val) => !isNaN(Date.parse(val)), {
  message: 'Invalid ISO date format',
});

const setupSchema = z.object({
  companyName: z.string().min(2, 'Company name is required'),
  adminEmail: z.string().email('Valid admin email is required'),
  adminPassword: z.string().min(8, 'Admin password must be at least 8 characters'),
  officeStartTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be HH:MM').optional(),
  officeEndTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be HH:MM').optional(),
  graceMinutes: z.number().int().min(0).max(120).optional(),
  officeLatitude: z.union([z.number(), z.null(), z.literal('')]).optional().transform(v => (v === '' || v == null ? null : v)),
  officeLongitude: z.union([z.number(), z.null(), z.literal('')]).optional().transform(v => (v === '' || v == null ? null : v)),
  officeRadiusMeters: z.union([z.number(), z.null(), z.literal('')]).optional().transform(v => (v === '' || v == null ? null : v)),
});

const loginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

const createHrUserSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const employeeRegisterSchema = z.object({
  employeeCode: z.string().min(2, 'Employee code is required').trim(),
  firstName: z.string().min(1, 'First name is required').trim(),
  lastName: z.string().min(1, 'Last name is required').trim(),
  email: z.string().email('Valid email is required').trim().toLowerCase(),
  departmentId: z.string().min(1, 'Department is required'),
  designationId: z.string().min(1, 'Designation is required'),
  joiningDate: isoDateString,
  basicSalary: z.number({ required_error: 'Salary is required' }).positive('Salary must be greater than 0'),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  dateOfBirth: isoDateString.optional().nullable(),
  temporaryPassword: z.string().min(6).optional(),
});

const employeeSelfUpdateSchema = z.object({
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
});

const employeeHrUpdateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  departmentId: z.string().min(1).optional(),
  designationId: z.string().min(1).optional(),
  basicSalary: z.number().positive().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED']).optional(),
  exitDate: isoDateString.optional().nullable(),
});

const attendanceCheckInSchema = z.object({
  source: z.string().optional(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  accuracy: z.number().optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
});

const attendanceCheckOutSchema = z.object({
  lat: z.number().optional(),
  lng: z.number().optional(),
});

const attendanceCorrectionSchema = z.object({
  attendanceDate: isoDateString,
  requestedCheckIn: isoDateString,
  requestedCheckOut: isoDateString,
  reason: z.string().min(3, 'Reason must be at least 3 characters'),
});

const correctionReviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reviewerComment: z.string().optional(),
});

const leaveApplySchema = z.object({
  leaveTypeId: z.string().min(1, 'Leave type is required'),
  startDate: isoDateString,
  endDate: isoDateString,
  reason: z.string().min(3, 'Reason must be at least 3 characters'),
});

const leaveReviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reviewerComment: z.string().optional(),
});

const payrollDraftSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
});

const companySettingsSchema = z.object({
  companyName: z.string().min(2).optional(),
  officeStartTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  officeEndTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  graceMinutes: z.number().int().min(0).max(120).optional(),
  halfDayHours: z.number().positive().max(12).optional(),
  weekendDays: z.string().optional(),
  officeLatitude: z.number().optional().nullable(),
  officeLongitude: z.number().optional().nullable(),
  officeRadiusMeters: z.number().positive().optional().nullable(),
});

const departmentSchema = z.object({
  name: z.string().min(2, 'Department name is required'),
  code: z.string().min(2, 'Department code is required'),
  description: z.string().optional(),
});

const designationSchema = z.object({
  title: z.string().min(2, 'Designation title is required'),
  description: z.string().optional(),
});

const holidaySchema = z.object({
  name: z.string().min(2, 'Holiday name is required'),
  date: isoDateString,
  description: z.string().optional(),
});

const leaveTypeSchema = z.object({
  name: z.string().min(2, 'Leave type name is required'),
  code: z.string().min(2, 'Leave code is required').toUpperCase(),
  annualQuota: z.number().int().min(0),
  isUnpaid: z.boolean().default(false),
  description: z.string().optional(),
});

const announcementSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  content: z.string().min(5, 'Content must be at least 5 characters'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
});

module.exports = {
  setupSchema,
  loginSchema,
  changePasswordSchema,
  createHrUserSchema,
  employeeRegisterSchema,
  employeeSelfUpdateSchema,
  employeeHrUpdateSchema,
  attendanceCheckInSchema,
  attendanceCheckOutSchema,
  attendanceCorrectionSchema,
  correctionReviewSchema,
  leaveApplySchema,
  leaveReviewSchema,
  payrollDraftSchema,
  companySettingsSchema,
  departmentSchema,
  designationSchema,
  holidaySchema,
  leaveTypeSchema,
  announcementSchema,
};
