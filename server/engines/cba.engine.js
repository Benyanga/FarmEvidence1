/**
 * CBA Engine — Cost-Benefit Analysis, pure function.
 * See docs/COMPUTATION_ENGINE.md §4.
 *
 * computePlotCBA/computeFarmerAdoptionCost are Farmer Mode only (the CSI/
 * phase-adjusted C_sys/C_time model). Research Mode's CBA is a direct
 * treatment-mean roll-up with no efficiency adjustment — see
 * researchAnalysis.engine.js — but reuses the generic indicator functions
 * below (computeGrossMargin..computePartialBudget), since those formulas are
 * mode-agnostic.
 *
 * C_base is supplied by the caller as the sum of a plot's recorded Input
 * Cost + Labour Cost ledger rows (C_SD + C_SI — see compute.controller's
 * plotCostBreakdown), replacing the old fixed cost-category enum.
 *
 * C_sys interpretation: the doc defines C_sys as "the difference between CF and
 * CA costs driven by E_i(t,S)" using Q_CA,i(t) = Q_CF,i × [1 − E_i(t,S)]. This
 * engine treats the plot's own C_base as the Q_CF,i baseline for a CA season
 * (i.e. what this activity would cost without efficiency gains), so
 * C_sys = Q_CA,i(t) − Q_CF,i = −(C_base × E_i(t,S)) — a negative adjustment
 * (savings) that only applies when the season's farming system is CA. A CF
 * season is the baseline itself, so C_sys = 0.
 */

const SYSTEM_COST_CATEGORIES = ['tillage', 'fertilizer', 'pesticide', 'irrigation', 'residueManagement'];

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * @param {object} params
 * @param {number} params.cBase - total recorded cost of production (C_SD + C_SI) for the plot
 * @param {number} params.farmingSystem - 'CA' | 'CF' (from the plot's season)
 * @param {number} params.eiTS - E_i(t,S) from efficiency.engine
 * @param {number} params.phi - φ(t) from efficiency.engine
 * @param {number} params.csi - CSI(S) ∈ [0,1]
 * @param {{value:number, isObserved:boolean}} [params.yield]
 * @param {{value:number}} [params.sellingPrice]
 * @param {number} [params.revenueOverride] - use a directly-observed revenue (Farmer Mode yield ledger) instead of yield×price
 * @param {number} [params.yieldOverride] - use a directly-observed yield total (Farmer Mode yield ledger)
 */
function computePlotCBA({
  cBase = 0,
  farmingSystem,
  eiTS = 0,
  phi = 0,
  csi = 0,
  yield: yld,
  sellingPrice,
  revenueOverride,
  yieldOverride
}) {
  const missingData = [];

  const cSys = farmingSystem === 'CA' ? round2(-(cBase * eiTS)) : 0;
  const cTime = round2(cBase * phi * (1 - csi));
  const cSystem = round2(cBase + cSys + cTime);

  let revenue = null;
  let yieldValue = typeof yieldOverride === 'number' ? yieldOverride : yld?.value;

  if (typeof revenueOverride === 'number') {
    revenue = round2(revenueOverride);
  } else {
    const yieldObserved = yld && yld.isObserved !== false && typeof yld.value === 'number';
    if (!yieldObserved) missingData.push('yield.value');
    const priceKnown = sellingPrice && typeof sellingPrice.value === 'number';
    if (!priceKnown) missingData.push('sellingPrice.value');
    if (yieldObserved && priceKnown) revenue = round2(yld.value * sellingPrice.value);
  }

  const canCompute = revenue !== null;
  const profit = canCompute ? round2(revenue - cSystem) : null;

  return {
    cBase,
    cSys,
    cTime,
    cSystem,
    revenue,
    profit,
    yieldValue: typeof yieldValue === 'number' ? yieldValue : null,
    canCompute,
    missingData
  };
}

/**
 * Gross Margin = Revenue − total cost of production. Identical to profit, exposed for report clarity.
 * Kept unrounded (not round2): per-plot values here feed treatment-level
 * aggregation (descriptive stats, ANOVA, t-test), and rounding at this stage
 * compounds across replicates into CI/F/p values that drift outside the
 * required tolerance. Round only at final display.
 */
function computeGrossMargin(revenue, cSystem) {
  if (typeof revenue !== 'number' || typeof cSystem !== 'number') return null;
  return revenue - cSystem;
}

/** Adjusted Gross Margin = Revenue − C_SD. Isolates the system effect by excluding costs standardized across systems. Unrounded — see computeGrossMargin. */
function computeAdjustedGrossMargin(revenue, cSD) {
  if (typeof revenue !== 'number' || typeof cSD !== 'number') return null;
  return revenue - cSD;
}

/** Benefit-Cost Ratio = Revenue / Total Cost of Production (a ratio, not an RWF amount — kept unrounded). */
function computeBCR(revenue, totalCost) {
  if (!totalCost || typeof revenue !== 'number') return null;
  return revenue / totalCost;
}

/** ROI % = (Gross Margin / Total Cost of Production) × 100 (a ratio-derived %, kept unrounded). */
function computeROI(grossMargin, totalCost) {
  if (!totalCost || typeof grossMargin !== 'number') return null;
  return (grossMargin / totalCost) * 100;
}

/** Cost of Production per kg = Total Cost / Total Yield (kg) */
function computeCostPerKg(totalCost, yieldKg) {
  if (!yieldKg || typeof totalCost !== 'number') return null;
  return round2(totalCost / yieldKg);
}

/** Break-even Yield (kg) = Total Cost of Production / Market Price */
function computeBreakEvenYield(totalCost, price) {
  if (!price || typeof totalCost !== 'number') return null;
  return round2(totalCost / price);
}

/** Yield Margin of Safety % = (Actual Yield − Break-even Yield) / Actual Yield × 100 */
function computeYieldMarginOfSafety(actualYield, breakEvenYield) {
  if (!actualYield || typeof breakEvenYield !== 'number') return null;
  return round2(((actualYield - breakEvenYield) / actualYield) * 100);
}

/**
 * Yield Stability & Sensitivity Analysis — Pessimistic / Expected / Optimistic
 * gross margin under a simultaneous price-down/cost-up (or reverse) shock.
 * @param {object} params
 * @param {number} params.yieldKg
 * @param {number} params.price
 * @param {number} params.totalCost
 * @param {number} [params.priceAdj] - fractional swing applied to price (default 0.2)
 * @param {number} [params.costAdj] - fractional swing applied to cost (default 0.2)
 */
function computeSensitivityScenarios({ yieldKg, price, totalCost, priceAdj = 0.2, costAdj = 0.2 }) {
  if (typeof yieldKg !== 'number' || typeof price !== 'number' || typeof totalCost !== 'number') return null;
  const pessimistic = round2(yieldKg * price * (1 - priceAdj) - totalCost * (1 + costAdj));
  const expected = round2(yieldKg * price - totalCost);
  const optimistic = round2(yieldKg * price * (1 + priceAdj) - totalCost * (1 - costAdj));
  return { pessimistic, expected, optimistic };
}

/**
 * Partial Budget Analysis — net effect of switching from a baseline system to
 * an alternative, expressed as additional benefits/costs and return per RWF invested.
 * @param {object} params
 * @param {number} params.additionalBenefits - extra revenue + costs saved by switching
 * @param {number} params.additionalCosts - extra costs incurred by switching
 */
function computePartialBudget({ additionalBenefits, additionalCosts }) {
  if (typeof additionalBenefits !== 'number' || typeof additionalCosts !== 'number') return null;
  const netChange = round2(additionalBenefits - additionalCosts);
  const returnPerInvested = additionalCosts !== 0 ? round2(netChange / additionalCosts) : null;
  return {
    additionalBenefits: round2(additionalBenefits),
    additionalCosts: round2(additionalCosts),
    netChange,
    returnPerInvested
  };
}

/**
 * Farmer Mode: max(0, Profit_prev − Profit_curr), only on system-change events.
 * @param {number} profitPrev - profit of last season before the system change
 * @param {number} profitCurr - profit of first season after the system change
 * @param {boolean} systemChanged - whether a treatment switch occurred
 */
function computeFarmerAdoptionCost(profitPrev, profitCurr, systemChanged) {
  if (!systemChanged) return 0;
  if (typeof profitPrev !== 'number' || typeof profitCurr !== 'number') return null;
  return round2(Math.max(0, profitPrev - profitCurr));
}

/**
 * Farmer Mode: how far a CA season's profit still trails the farm's own
 * conventional (CF) baseline — unlike computeFarmerAdoptionCost (a one-shot
 * value only at the literal switch season), this is meant to be called for
 * every subsequent CA season against the same fixed prior-CF-season profit,
 * so callers can show the gap narrowing over consecutive seasons.
 * @param {number} caProfit - this season's profit (farmingSystem === 'CA')
 * @param {number} cfBaselineProfit - the farm's most recent prior CF-season profit
 */
function computeAdoptionGap(caProfit, cfBaselineProfit) {
  if (typeof caProfit !== 'number' || typeof cfBaselineProfit !== 'number') return null;
  return round2(Math.max(0, cfBaselineProfit - caProfit));
}

module.exports = {
  computePlotCBA,
  computeFarmerAdoptionCost,
  computeAdoptionGap,
  computeGrossMargin,
  computeAdjustedGrossMargin,
  computeBCR,
  computeROI,
  computeCostPerKg,
  computeBreakEvenYield,
  computeYieldMarginOfSafety,
  computeSensitivityScenarios,
  computePartialBudget,
  SYSTEM_COST_CATEGORIES
};
