/**
 * Yield Ledger Engine — pure function, no DB access.
 * Computes the running remaining-yield balance and per-row revenue for the
 * Farmer Mode Yield & Revenue table. A row may harvest, sell, or both; a
 * sale-only row draws down the balance carried from the previous row.
 */

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * @param {object} params
 * @param {number} [params.prevRemaining] - remainingYield of the prior row (0 if first)
 * @param {number} [params.yieldHarvested]
 * @param {number} [params.yieldSold]
 * @param {number} [params.marketPrice]
 * @returns {{remainingYield:number, totalRevenue:number}}
 */
function computeYieldLedgerRow({ prevRemaining = 0, yieldHarvested = 0, yieldSold = 0, marketPrice = 0 }) {
  const remainingYield = round2((prevRemaining || 0) + (yieldHarvested || 0) - (yieldSold || 0));
  const totalRevenue = round2((yieldSold || 0) * (marketPrice || 0));
  return { remainingYield, totalRevenue };
}

/**
 * Replays a full ordered sequence of rows, recomputing the running balance
 * for each — used after an edit/delete shifts an earlier row.
 * @param {Array<{yieldHarvested:number, yieldSold:number, marketPrice:number}>} rows - chronological order
 * @returns {Array<{remainingYield:number, totalRevenue:number}>}
 */
function recomputeYieldLedger(rows = []) {
  let prevRemaining = 0;
  return rows.map((row) => {
    const { remainingYield, totalRevenue } = computeYieldLedgerRow({ prevRemaining, ...row });
    prevRemaining = remainingYield;
    return { remainingYield, totalRevenue };
  });
}

module.exports = { computeYieldLedgerRow, recomputeYieldLedger };
