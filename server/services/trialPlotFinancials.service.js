const TrialInputCost = require('../models/TrialInputCost');
const TrialLaborCost = require('../models/TrialLaborCost');

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Sums a TrialPlot's Input Costs + Labour Costs, split by C_SD / C_SI —
 * mirrors plotFinancials.service.js's plotCostBreakdown, but over the
 * recorder-tagged Research Mode cost logs (no auto-classifier).
 */
async function trialPlotCostBreakdown(trialPlotId) {
  const [costs, labor] = await Promise.all([
    TrialInputCost.find({ trialPlotId }),
    TrialLaborCost.find({ trialPlotId })
  ]);

  let cSD = 0;
  let cSI = 0;
  let laborTimeMinutes = 0;
  for (const c of costs) {
    if (c.costType === 'C_SD') cSD += c.totalCostRwf || 0;
    else cSI += c.totalCostRwf || 0;
  }
  for (const l of labor) {
    if (l.costType === 'C_SD') cSD += l.totalCostRwf || 0;
    else cSI += l.totalCostRwf || 0;
    laborTimeMinutes += l.timeMinutes || 0;
  }

  // Deliberately unrounded (not round2): these feed treatment-level series
  // for descriptive stats/ANOVA/t-test downstream (see researchAnalysis.
  // engine.js's computePlotRollup), where C_SD's naturally small variance
  // makes per-plot 2dp rounding here measurably distort SS/MS/F. Round only
  // at final display.
  return {
    cSD,
    cSI,
    total: cSD + cSI,
    inputCostTotal: costs.reduce((s, c) => s + (c.totalCostRwf || 0), 0),
    laborCostTotal: labor.reduce((s, l) => s + (l.totalCostRwf || 0), 0),
    laborTimeMinutes
  };
}

/**
 * Component-level breakdown (by inputItem/practice name), for cost-structure
 * analysis (§6.2) — parallels compute.controller's old costItemTotals.
 */
async function trialPlotComponentTotals(trialPlotIds) {
  const [costs, labor] = await Promise.all([
    TrialInputCost.find({ trialPlotId: { $in: trialPlotIds } }),
    TrialLaborCost.find({ trialPlotId: { $in: trialPlotIds } })
  ]);
  const items = {};
  const inputItems = {};
  const labourItems = {};
  let cSD = 0;
  let cSI = 0;
  for (const c of costs) {
    items[c.inputItem] = (items[c.inputItem] || 0) + (c.totalCostRwf || 0);
    inputItems[c.inputItem] = (inputItems[c.inputItem] || 0) + (c.totalCostRwf || 0);
    if (c.costType === 'C_SD') cSD += c.totalCostRwf || 0;
    else cSI += c.totalCostRwf || 0;
  }
  for (const l of labor) {
    items[l.practice] = (items[l.practice] || 0) + (l.totalCostRwf || 0);
    labourItems[l.practice] = (labourItems[l.practice] || 0) + (l.totalCostRwf || 0);
    if (l.costType === 'C_SD') cSD += l.totalCostRwf || 0;
    else cSI += l.totalCostRwf || 0;
  }
  return { items, inputItems, labourItems, cSD: round2(cSD), cSI: round2(cSI) };
}

module.exports = { trialPlotCostBreakdown, trialPlotComponentTotals };
