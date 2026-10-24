const test = require('node:test');
const assert = require('node:assert/strict');
const { getWorkingDaysBetween } = require('../src/utils/dateUtils');

test('Leave Business Rules - Working Days Calculation', async (t) => {
  await t.test('Skips weekends correctly', () => {
    // 2026-10-19 (Monday) to 2026-10-25 (Sunday) = 7 calendar days
    // Working days: Mon, Tue, Wed, Thu, Fri = 5 days (Sat & Sun excluded)
    const start = new Date(Date.UTC(2026, 9, 19));
    const end = new Date(Date.UTC(2026, 9, 25));

    const result = getWorkingDaysBetween(start, end, ['Saturday', 'Sunday'], []);
    assert.equal(result.count, 5);
  });

  await t.test('Skips public holidays occurring on working days', () => {
    // 2026-10-19 (Mon) to 2026-10-23 (Fri) = 5 days
    // If 2026-10-21 (Wed) is a holiday -> 4 working days
    const start = new Date(Date.UTC(2026, 9, 19));
    const end = new Date(Date.UTC(2026, 9, 23));
    const holidays = ['2026-10-21'];

    const result = getWorkingDaysBetween(start, end, ['Saturday', 'Sunday'], holidays);
    assert.equal(result.count, 4);
  });

  await t.test('Returns 0 working days if range only spans weekends', () => {
    // Saturday to Sunday
    const start = new Date(Date.UTC(2026, 9, 24));
    const end = new Date(Date.UTC(2026, 9, 25));

    const result = getWorkingDaysBetween(start, end, ['Saturday', 'Sunday'], []);
    assert.equal(result.count, 0);
  });
});
