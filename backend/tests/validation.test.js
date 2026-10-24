const test = require('node:test');
const assert = require('node:assert/strict');
const { employeeRegisterSchema } = require('../src/validators');

test('Employee Registration Validation Schema', async (t) => {
  await t.test('Accepts valid employee registration payload', () => {
    const validPayload = {
      employeeCode: 'EMP-001',
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice.smith@example.com',
      departmentId: 'dept-uuid-123',
      designationId: 'desig-uuid-456',
      joiningDate: '2026-05-01',
      basicSalary: 65000,
      phone: '+1 555-0199',
      address: '123 Market Street',
    };

    const parsed = employeeRegisterSchema.safeParse(validPayload);
    assert.equal(parsed.success, true);
  });

  await t.test('Rejects invalid email format', () => {
    const invalidEmailPayload = {
      employeeCode: 'EMP-002',
      firstName: 'Bob',
      lastName: 'Taylor',
      email: 'not-an-email',
      departmentId: 'dept-123',
      designationId: 'desig-456',
      joiningDate: '2026-05-01',
      basicSalary: 50000,
    };

    const parsed = employeeRegisterSchema.safeParse(invalidEmailPayload);
    assert.equal(parsed.success, false);
    assert.ok(parsed.error.errors.some((e) => e.path.includes('email')));
  });

  await t.test('Rejects negative or zero salary', () => {
    const zeroSalaryPayload = {
      employeeCode: 'EMP-003',
      firstName: 'Charlie',
      lastName: 'Brown',
      email: 'charlie@example.com',
      departmentId: 'dept-123',
      designationId: 'desig-456',
      joiningDate: '2026-05-01',
      basicSalary: 0,
    };

    const parsed = employeeRegisterSchema.safeParse(zeroSalaryPayload);
    assert.equal(parsed.success, false);
    assert.ok(parsed.error.errors.some((e) => e.path.includes('basicSalary')));
  });

  await t.test('Rejects non-ISO date format for joining date', () => {
    const badDatePayload = {
      employeeCode: 'EMP-004',
      firstName: 'David',
      lastName: 'Miller',
      email: 'david@example.com',
      departmentId: 'dept-123',
      designationId: 'desig-456',
      joiningDate: 'yesterday',
      basicSalary: 75000,
    };

    const parsed = employeeRegisterSchema.safeParse(badDatePayload);
    assert.equal(parsed.success, false);
    assert.ok(parsed.error.errors.some((e) => e.path.includes('joiningDate')));
  });

  await t.test('Rejects missing required fields', () => {
    const missingFieldsPayload = {
      firstName: 'Eva',
    };

    const parsed = employeeRegisterSchema.safeParse(missingFieldsPayload);
    assert.equal(parsed.success, false);
    const missingKeys = parsed.error.errors.map((e) => e.path[0]);
    assert.ok(missingKeys.includes('employeeCode'));
    assert.ok(missingKeys.includes('email'));
    assert.ok(missingKeys.includes('departmentId'));
    assert.ok(missingKeys.includes('basicSalary'));
  });
});
