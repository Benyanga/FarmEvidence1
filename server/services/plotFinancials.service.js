const CostRecord = require('../models/CostRecord');
const LaborRecord = require('../models/LaborRecord');
const YieldRecord = require('../models/YieldRecord');

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Sums a plot's Input Costs + Labour Costs, split by C_SD / C_SI class.
 * Replaces the old fixed cost-category aggregation now that costs are
 * recorded as free-form Input/Activity rows tagged with a cost class.
 */
async function plotCostBreakdown(plotId) {
  const [costs, labor] = await Promise.all([
    CostRecord.find({ plotId }),
    LaborRecord.find({ plotId })
  ]);

  let cSD = 0;
  let cSI = 0;
  for (const c of costs) {
    if (c.costClass === 'C_SD') cSD += c.totalCost || 0;
    else cSI += c.totalCost || 0;
  }
  for (const l of labor) {
    if (l.costClass === 'C_SD') cSD += l.laborCost || 0;
    else cSI += l.laborCost || 0;
  }

  cSD = round2(cSD);
  cSI = round2(cSI);
  return { cSD, cSI, total: round2(cSD + cSI), inputCostTotal: round2(costs.reduce((s, c) => s + (c.totalCost || 0), 0)), laborCostTotal: round2(labor.reduce((s, l) => s + (l.laborCost || 0), 0)) };
}

/** Farmer Mode: totals from the Yield & Revenue ledger (harvested/sold/remaining/revenue). */
async function plotYieldSummary(plotId) {
  const rows = await YieldRecord.find({ plotId }).sort({ date: 1, createdAt: 1 });
  const totalHarvested = round2(rows.reduce((s, r) => s + (r.yieldHarvested || 0), 0));
  const totalSold = round2(rows.reduce((s, r) => s + (r.yieldSold || 0), 0));
  const totalRevenue = round2(rows.reduce((s, r) => s + (r.totalRevenue || 0), 0));
  const remainingYield = rows.length ? rows[rows.length - 1].remainingYield : 0;
  const lastPrice = [...rows].reverse().find((r) => typeof r.marketPrice === 'number')?.marketPrice ?? null;
  return { rows, totalHarvested, totalSold, totalRevenue, remainingYield, lastPrice };
}

/**
 * Component-level breakdown (by inputName/activity), for the dashboard's
 * cost-breakdown-by-category card — mirrors trialPlotComponentTotals in
 * trialPlotFinancials.service.js exactly, over the Farmer Mode collections.
 */
async function plotComponentTotals(plotId) {
  const [costs, labor] = await Promise.all([CostRecord.find({ plotId }), LaborRecord.find({ plotId })]);
  const items = {};
  let cSD = 0;
  let cSI = 0;
  for (const c of costs) {
    items[c.inputName] = (items[c.inputName] || 0) + (c.totalCost || 0);
    if (c.costClass === 'C_SD') cSD += c.totalCost || 0;
    else cSI += c.totalCost || 0;
  }
  for (const l of labor) {
    items[l.activity] = (items[l.activity] || 0) + (l.laborCost || 0);
    if (l.costClass === 'C_SD') cSD += l.laborCost || 0;
    else cSI += l.laborCost || 0;
  }
  return { items, cSD: round2(cSD), cSI: round2(cSI) };
}

module.exports = { plotCostBreakdown, plotYieldSummary, plotComponentTotals };
