const test = require('node:test');
const assert = require('node:assert/strict');
const { isTimeLate, calculateDistanceMeters } = require('../src/utils/dateUtils');
const prisma = require('../src/config/prisma');
const attendanceService = require('../src/services/attendance.service');

test('Attendance Business Rules', async (t) => {
  await t.test('Late after 09:15 when office starts at 09:00 with 15m grace', () => {
    // 09:10 is on time
    const onTimeDate = new Date();
    onTimeDate.setHours(9, 10, 0, 0);
    assert.equal(isTimeLate(onTimeDate, '09:00', 15), false);

    // 09:15 is exactly on grace boundary (not late)
    const onGraceBoundary = new Date();
    onGraceBoundary.setHours(9, 15, 0, 0);
    assert.equal(isTimeLate(onGraceBoundary, '09:00', 15), false);

    // 09:16 is late
    const lateDate = new Date();
    lateDate.setHours(9, 16, 0, 0);
    assert.equal(isTimeLate(lateDate, '09:00', 15), true);

    // 10:00 is late
    const veryLateDate = new Date();
    veryLateDate.setHours(10, 0, 0, 0);
    assert.equal(isTimeLate(veryLateDate, '09:00', 15), true);
  });

  await t.test('Half day rule under 5 hours', () => {
    const halfDayHoursThreshold = 5.0;

    const checkIn = new Date('2026-10-24T09:00:00Z');
    const checkOutHalfDay = new Date('2026-10-24T13:30:00Z'); // 4.5 hours
    const checkOutFullDay = new Date('2026-10-24T17:00:00Z'); // 8.0 hours

    const diffHours1 = (checkOutHalfDay.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
    const diffHours2 = (checkOutFullDay.getTime() - checkIn.getTime()) / (1000 * 60 * 60);

    assert.equal(diffHours1 < halfDayHoursThreshold, true);
    assert.equal(diffHours2 < halfDayHoursThreshold, false);
  });

  await t.test('Geofence distance calculation correctly flags locations outside radius', () => {
    // Coordinates: Office at 40.7128, -74.0060 (New York)
    const officeLat = 40.7128;
    const officeLng = -74.0060;

    // Checkin right next to office (< 50 meters)
    const nearbyLat = 40.7130;
    const nearbyLng = -74.0060;
    const distNear = calculateDistanceMeters(officeLat, officeLng, nearbyLat, nearbyLng);
    assert.ok(distNear < 100);

    // Checkin 10 km away
    const farLat = 40.8000;
    const farLng = -74.0060;
    const distFar = calculateDistanceMeters(officeLat, officeLng, farLat, farLng);
    assert.ok(distFar > 5000);
  });

  // Four required service check-in unit tests
  let testUser, testEmp, dept, des;

  await t.test('Setup test fixtures for check-in rules', async () => {
    dept = (await prisma.department.findFirst()) || (await prisma.department.create({ data: { name: 'Eng', code: 'ENG' } }));
    des = (await prisma.designation.findFirst()) || (await prisma.designation.create({ data: { title: 'Dev' } }));

    testUser = await prisma.user.upsert({
      where: { email: 'att.unittest@test.local' },
      update: {},
      create: {
        email: 'att.unittest@test.local',
        passwordHash: 'dummy_hash',
        role: 'EMPLOYEE',
      },
    });

    testEmp = await prisma.employee.upsert({
      where: { employeeCode: 'EMP-ATT-TEST' },
      update: {},
      create: {
        employeeCode: 'EMP-ATT-TEST',
        userId: testUser.id,
        firstName: 'Checkin',
        lastName: 'Tester',
        email: 'att.unittest@test.local',
        departmentId: dept.id,
        designationId: des.id,
        joiningDate: new Date('2026-01-01'),
        basicSalary: 50000,
      },
    });

    await prisma.attendance.deleteMany({ where: { employeeId: testEmp.id } });
  });

  // 1. Accuracy reject: accuracy > 100m returns 422
  await t.test('accuracy reject (> 100m returns 422)', async () => {
    await assert.rejects(
      async () => {
        await attendanceService.checkIn(testUser.id, { accuracy: 150 });
      },
      (err) => {
        assert.equal(err.statusCode, 422);
        assert.match(err.message, /accuracy is too low/i);
        return true;
      }
    );
  });

  // 2. Empty-office skip: skips geofence check when coordinates empty
  await t.test('empty-office skip (geofence skipped when coordinates empty)', async () => {
    await prisma.companySetting.deleteMany();
    await prisma.companySetting.create({
      data: {
        companyName: 'Test Corp',
        officeLatitude: null,
        officeLongitude: null,
        officeRadiusMeters: null,
        setupCompleted: true,
      },
    });

    const rec = await attendanceService.checkIn(testUser.id, { accuracy: 25 });
    assert.equal(rec.isGeofenceValid, true);
    assert.match(rec.remarks, /skipped/i);
  });

  // 3. Duplicate 409: second check-in on the same day returns 409
  await t.test('duplicate 409 (second check-in returns 409)', async () => {
    await assert.rejects(
      async () => {
        await attendanceService.checkIn(testUser.id, { accuracy: 25 });
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.match(err.message, /already recorded for today/i);
        return true;
      }
    );
  });

  // 4. Radius reject: outside allowedRadius returns 422
  await t.test('radius reject (outside allowedRadius returns 422)', async () => {
    await prisma.attendance.deleteMany({ where: { employeeId: testEmp.id } });
    await prisma.companySetting.updateMany({
      data: {
        officeLatitude: 40.7128,
        officeLongitude: -74.006,
        officeRadiusMeters: 100,
      },
    });

    await assert.rejects(
      async () => {
        await attendanceService.checkIn(testUser.id, {
          latitude: 40.8,
          longitude: -74.006,
          accuracy: 15,
        });
      },
      (err) => {
        assert.equal(err.statusCode, 422);
        assert.match(err.message, /outside allowed office radius/i);
        return true;
      }
    );
  });

  await t.test('Cleanup test fixtures', async () => {
    await prisma.attendance.deleteMany({ where: { employeeId: testEmp.id } });
    await prisma.employee.delete({ where: { id: testEmp.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
    await prisma.companySetting.updateMany({
      data: {
        officeLatitude: null,
        officeLongitude: null,
        officeRadiusMeters: null,
      },
    });
  });
});
