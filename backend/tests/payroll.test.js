const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateAnnualTax, calculateMonthlyTax } = require('../src/utils/taxCalculator');
const { calculateEmployeeSalaryBreakdown } = require('../src/utils/payrollCalculator');

test('Tax Calculator - Illustrative Slabs', async (t) => {
  await t.test('0 to 600k is 0%', () => {
    assert.equal(calculateAnnualTax(500000), 0);
    assert.equal(calculateAnnualTax(600000), 0);
  });

  await t.test('to 1.2M is 5% on excess over 600k', () => {
    // 1,000,000 - 600,000 = 400,000 * 0.05 = 20,000
    assert.equal(calculateAnnualTax(1000000), 20000);
    // 1,200,000 - 600,000 = 600,000 * 0.05 = 30,000
    assert.equal(calculateAnnualTax(1200000), 30000);
  });

  await t.test('to 2.4M is 30k + 15% on excess over 1.2M', () => {
    // 2,000,000: 30,000 + (800,000 * 0.15 = 120,000) = 150,000
    assert.equal(calculateAnnualTax(2000000), 150000);
    // 2,400,000: 30,000 + (1,200,000 * 0.15 = 180,000) = 210,000
    assert.equal(calculateAnnualTax(2400000), 210000);
  });

  await t.test('to 3.6M is 210k + 25% on excess over 2.4M', () => {
    // 3,000,000: 210,000 + (600,000 * 0.25 = 150,000) = 360,000
    assert.equal(calculateAnnualTax(3000000), 360000);
    // 3,600,000: 210,000 + (1,200,000 * 0.25 = 300,000) = 510,000
    assert.equal(calculateAnnualTax(3600000), 510000);
  });

  await t.test('above 3.6M is 510k + 35% on excess over 3.6M', () => {
    // 4,000,000: 510,000 + (400,000 * 0.35 = 140,000) = 650,000
    assert.equal(calculateAnnualTax(4000000), 650000);
  });

  await t.test('Monthly tax is annual tax / 12', () => {
    // 100,000 monthly -> 1,200,000 annual -> tax 30,000 -> monthly 2,500
    assert.equal(calculateMonthlyTax(100000), 2500);
  });
});

test('Payroll Calculator - Gross, Deductions, and Proration', async (t) => {
  await t.test('Gross is 1.5 x basic (40% HRA, 10% Medical)', () => {
    const res = calculateEmployeeSalaryBreakdown({
      basicSalary: 20000,
      workingDaysInMonth: 20,
    });

    assert.equal(res.basicSalary, 20000);
    assert.equal(res.hraAllowance, 8000);
    assert.equal(res.medicalAllowance, 2000);
    assert.equal(res.grossSalary, 30000); // 1.5 * 20000
    assert.equal(res.perDaySalary, 1500); // 30000 / 20
  });

  await t.test('Deducts absent days, unpaid leaves, and 0.5 x half days', () => {
    // perDay = 30000 / 20 = 1500
    // Penalties: 1 absent + 2 unpaid + (0.5 * 2 half days = 1) = 4 penalty days
    // Deduction: 4 * 1500 = 6000
    const res = calculateEmployeeSalaryBreakdown({
      basicSalary: 20000,
      workingDaysInMonth: 20,
      absentDays: 1,
      unpaidLeaveDays: 2,
      halfDays: 2,
    });

    assert.equal(res.absenteeismDeduction, 6000);
    assert.ok(res.totalDeductions >= 6000);
    assert.equal(res.netSalary, res.grossSalary - res.totalDeductions);
  });

  await t.test('Prorates mid-month joiners', () => {
    // Month with 20 working days, employee joined halfway through (e.g. 10 working days active)
    const monthStart = new Date(Date.UTC(2026, 9, 1));
    const monthEnd = new Date(Date.UTC(2026, 9, 31));
    const joinDate = new Date(Date.UTC(2026, 9, 15));

    const res = calculateEmployeeSalaryBreakdown({
      basicSalary: 20000,
      workingDaysInMonth: 22,
      joiningDate: joinDate,
      monthStartDate: monthStart,
      monthEndDate: monthEnd,
    });

    assert.equal(res.isProrated, true);
    assert.ok(res.prorationDeduction > 0);
    assert.ok(res.prorationReason.includes('Joined mid-month'));
  });
});
