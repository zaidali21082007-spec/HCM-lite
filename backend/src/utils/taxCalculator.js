/**
 * Tax on annual gross (gross x 12), illustrative slabs:
 * - 0 to 600,000: 0%
 * - to 1,200,000: 5% (on excess over 600,000)
 * - to 2,400,000: 30,000 + 15% (on excess over 1,200,000)
 * - to 3,600,000: 210,000 + 25% (on excess over 2,400,000)
 * - above 3,600,000: 510,000 + 35% (on excess over 3,600,000)
 */

function calculateAnnualTax(annualGross) {
  if (annualGross <= 0) return 0;

  if (annualGross <= 600000) {
    return 0;
  } else if (annualGross <= 1200000) {
    return (annualGross - 600000) * 0.05;
  } else if (annualGross <= 2400000) {
    return 30000 + (annualGross - 1200000) * 0.15;
  } else if (annualGross <= 3600000) {
    return 210000 + (annualGross - 2400000) * 0.25;
  } else {
    return 510000 + (annualGross - 3600000) * 0.35;
  }
}

function calculateMonthlyTax(monthlyGross) {
  const annualGross = monthlyGross * 12;
  const annualTax = calculateAnnualTax(annualGross);
  return Number((annualTax / 12).toFixed(2));
}

module.exports = {
  calculateAnnualTax,
  calculateMonthlyTax,
};
