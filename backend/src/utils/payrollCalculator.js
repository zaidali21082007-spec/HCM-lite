const { calculateMonthlyTax } = require('./taxCalculator');
const { getWorkingDaysBetween } = require('./dateUtils');

/**
 * Calculates complete salary breakdown for an employee in a given month.
 */
function calculateEmployeeSalaryBreakdown({
  basicSalary,
  workingDaysInMonth,
  workedDays = 0,
  absentDays = 0,
  halfDays = 0,
  unpaidLeaveDays = 0,
  joiningDate,
  exitDate,
  monthStartDate,
  monthEndDate,
  weekendDays = ['Saturday', 'Sunday'],
  holidayDates = [],
}) {
  const basic = Number(basicSalary) || 0;
  const hraAllowance = Number((basic * 0.4).toFixed(2));
  const medicalAllowance = Number((basic * 0.1).toFixed(2));
  const standardGross = Number((basic * 1.5).toFixed(2));

  // Determine proration if joined or exited mid-month
  let isProrated = false;
  let prorationReason = null;
  let activeWorkingDays = workingDaysInMonth;

  const joinDate = joiningDate ? new Date(joiningDate) : null;
  const exDate = exitDate ? new Date(exitDate) : null;

  let effectiveStartDate = monthStartDate;
  let effectiveEndDate = monthEndDate;

  if (joinDate && joinDate > monthStartDate && joinDate <= monthEndDate) {
    isProrated = true;
    effectiveStartDate = joinDate;
    prorationReason = `Joined mid-month on ${joinDate.toISOString().substring(0, 10)}`;
  }

  if (exDate && exDate >= monthStartDate && exDate < monthEndDate) {
    isProrated = true;
    effectiveEndDate = exDate;
    const exitReason = `Exited on ${exDate.toISOString().substring(0, 10)}`;
    prorationReason = prorationReason ? `${prorationReason}; ${exitReason}` : exitReason;
  }

  if (isProrated) {
    const activeResult = getWorkingDaysBetween(effectiveStartDate, effectiveEndDate, weekendDays, holidayDates);
    activeWorkingDays = activeResult.count;
  }

  // Per day salary based on standard monthly working days
  const perDaySalary = workingDaysInMonth > 0 ? Number((standardGross / workingDaysInMonth).toFixed(2)) : 0;

  // If prorated, base gross is adjusted for the unworked portion before joining or after exit
  const inactiveDays = Math.max(0, workingDaysInMonth - activeWorkingDays);
  const prorationDeduction = Number((perDaySalary * inactiveDays).toFixed(2));

  // Deduct absent days, unpaid leave, and 0.5 x half days
  // Formula: deduction = per_day_pay * (absent_days + unpaid_leave_days + 0.5 * half_days)
  const attendancePenaltyDays = absentDays + unpaidLeaveDays + 0.5 * halfDays;
  const absenteeismDeduction = Number((perDaySalary * attendancePenaltyDays).toFixed(2));

  // Tax is calculated on standard monthly gross equivalent
  const incomeTaxDeduction = calculateMonthlyTax(standardGross);

  const totalDeductions = Number((prorationDeduction + absenteeismDeduction + incomeTaxDeduction).toFixed(2));
  const netSalary = Math.max(0, Number((standardGross - totalDeductions).toFixed(2)));

  return {
    basicSalary: basic,
    hraAllowance,
    medicalAllowance,
    grossSalary: standardGross,
    perDaySalary,
    workedDays,
    absentDays,
    halfDays,
    unpaidLeaveDays,
    isProrated,
    prorationReason,
    activeWorkingDays,
    prorationDeduction,
    absenteeismDeduction,
    incomeTaxDeduction,
    otherDeductions: 0,
    totalDeductions,
    netSalary,
  };
}

module.exports = {
  calculateEmployeeSalaryBreakdown,
};
