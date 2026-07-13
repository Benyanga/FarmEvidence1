/**
 * Labour Cost Engine — pure function, no DB access.
 * Converts a Labour Costs table row (Time Taken + Unit) into a cost, using
 * the season's shared wage rate (RWF/day) and working-hours-per-day.
 */

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * @param {object} params
 * @param {number} params.timeTaken
 * @param {'days'|'hours'|'minutes'} params.unit
 * @param {number} params.wageRatePerDay
 * @param {number} [params.workingHoursPerDay]
 * @returns {number}
 */
function computeLaborRowCost({ timeTaken, unit, wageRatePerDay, workingHoursPerDay = 8 }) {
  if (typeof timeTaken !== 'number' || typeof wageRatePerDay !== 'number') return 0;

  if (unit === 'days') return round2(timeTaken * wageRatePerDay);
  if (unit === 'hours') return round2(timeTaken * (wageRatePerDay / workingHoursPerDay));
  if (unit === 'minutes') return round2(timeTaken * (wageRatePerDay / (workingHoursPerDay * 60)));
  return 0;
}

module.exports = { computeLaborRowCost };
