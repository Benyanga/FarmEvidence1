/**
 * Research Analysis Engine — Research Mode only, pure functions, no DB
 * access. Implements the generic t-treatments x b-replicates RCBD trial
 * pipeline (trial config -> per-plot roll-up -> treatment aggregation ->
 * CBA/cost-structure/risk/break-even/sensitivity/partial-budget). Generic
 * over the number of treatments — no CA/CF assumption anywhere.
 */

const {
  computeGrossMargin,
  computeAdjustedGrossMargin,
  computeBCR,
  computeROI,
  computeCostPerKg,
  computeBreakEvenYield,
  computeYieldMarginOfSafety,
  computePartialBudget
} = require('./cba.engine');
const { summarize } = require('./statistical.engine');

function round2(n) {
  return typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function mean(values) {
  const vals = values.filter((v) => typeof v === 'number');
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

/** §3.1 — Trial config derived fields (extrapolation, population, RCBD df/t-critical). */
function computeTrialConfigDerived(trial) {
  const { jStat } = require('jstat');
  const plotSizeM2 = trial.plotSizeM2;
  const extrapolationFactor = plotSizeM2 ? round2(10000 / plotSizeM2) : null;

  const interRowM = (trial.rowSpacing?.interRowCm || 0) / 100;
  const intraRowM = (trial.rowSpacing?.intraRowCm || 0) / 100;
  const stationArea = interRowM * intraRowM;
  const plantingStationsPerPlot = stationArea > 0 && plotSizeM2 ? Math.floor(plotSizeM2 / stationArea) : null;
  const cropPopulationPerPlot =
    plantingStationsPerPlot !== null && typeof trial.seedsPerHill === 'number'
      ? plantingStationsPerPlot * trial.seedsPerHill
      : null;
  const cropPopulationPerHa =
    cropPopulationPerPlot !== null && extrapolationFactor !== null
      ? Math.round(cropPopulationPerPlot * extrapolationFactor)
      : null;

  const dfError =
    typeof trial.numTreatments === 'number' && typeof trial.numReplicates === 'number'
      ? trial.numTreatments * (trial.numReplicates - 1)
      : null;
  const alpha = typeof trial.significanceLevel === 'number' ? trial.significanceLevel : 0.05;
  const tCritical = dfError > 0 ? round2(jStat.studentt.inv(1 - alpha / 2, dfError)) : null;

  return {
    extrapolationFactor,
    plantingStationsPerPlot,
    cropPopulationPerPlot,
    cropPopulationPerHa,
    dfError,
    tCritical
  };
}

/**
 * §4 — Per-plot roll-up from its cost breakdown and yield/revenue entry.
 * @param {object} params
 * @param {{cSD:number, cSI:number, total:number}} params.costBreakdown
 * @param {number} [params.grossRevenueRwf]
 * @param {number} [params.yieldKg]
 * @param {number} params.plotSizeM2
 */
function computePlotRollup({ costBreakdown, grossRevenueRwf, yieldKg, plotSizeM2 }) {
  const totalProductionCost = costBreakdown.total;
  const plotSizeHa = plotSizeM2 / 10000;
  const costPerM2 = plotSizeM2 ? round2(totalProductionCost / plotSizeM2) : null;
  const costPerHa = plotSizeHa ? round2(totalProductionCost / plotSizeHa) : null;

  const netBenefit = typeof grossRevenueRwf === 'number' ? computeGrossMargin(grossRevenueRwf, totalProductionCost) : null;
  const adjustedGrossMargin =
    typeof grossRevenueRwf === 'number' ? computeAdjustedGrossMargin(grossRevenueRwf, costBreakdown.cSD) : null;
  const bcr = typeof grossRevenueRwf === 'number' ? computeBCR(grossRevenueRwf, totalProductionCost) : null;
  const roi = netBenefit !== null ? computeROI(netBenefit, totalProductionCost) : null;
  const costPerKg = typeof yieldKg === 'number' ? computeCostPerKg(totalProductionCost, yieldKg) : null;

  // Deliberately unrounded (not round2): these per-plot values feed directly
  // into treatment-level series for descriptive stats/ANOVA/t-test. C_SD in
  // particular has very small natural variance across replicates, so
  // rounding each plot to the RWF cent here measurably distorts downstream
  // SS/MS/F (and t-statistics) even though the per-plot value itself would
  // still look fine at a glance. Round only at final display.
  return {
    subtotalInputCosts: costBreakdown.inputCostTotal,
    subtotalLabourCosts: costBreakdown.laborCostTotal,
    subtotalLabourTimeMin: costBreakdown.laborTimeMinutes,
    totalProductionCost,
    cSDTotal: costBreakdown.cSD,
    cSITotal: costBreakdown.cSI,
    costPerM2,
    costPerHa,
    netBenefit,
    adjustedGrossMargin,
    bcr,
    roi,
    costPerKg
  };
}

/** §5 — Treatment-level aggregation (mean/SD/SE/CI95/CV) of any per-plot variable. */
function aggregateTreatments(valuesByTreatment, alpha = 0.05) {
  const result = {};
  for (const [label, values] of Object.entries(valuesByTreatment)) {
    result[label] = summarize({ label, values: values.filter((v) => typeof v === 'number') }, alpha);
  }
  return result;
}

function argExtreme(entriesByLabel, key, mode) {
  const entries = Object.entries(entriesByLabel).filter(([, v]) => typeof v?.[key] === 'number');
  if (entries.length === 0) return null;
  return entries.reduce((best, cur) => {
    if (!best) return cur;
    return mode === 'max' ? (cur[1][key] > best[1][key] ? cur : best) : cur[1][key] < best[1][key] ? cur : best;
  }, null);
}

/**
 * §6.1 — CBA Summary per treatment (built from treatment means), plus
 * plain-language winner sentences.
 * @param {Object<string, object>} treatmentCba - label -> { grossRevenue, totalCost, netBenefit, cSD, cSI, adjustedGrossMargin, bcr, roi, yield, costPerKg }
 * @param {number} extrapolationFactor
 */
function computeCBASummary(treatmentCba, extrapolationFactor) {
  const summary = {};
  for (const [label, m] of Object.entries(treatmentCba)) {
    summary[label] = {
      avgGrossRevenuePerPlot: round2(m.grossRevenue),
      avgGrossRevenuePerHa: extrapolationFactor ? round2(m.grossRevenue * extrapolationFactor) : null,
      avgTotalProductionCost: round2(m.totalCost),
      netBenefit: round2(m.netBenefit),
      avgCSD: round2(m.cSD),
      avgCSI: round2(m.cSI),
      adjustedGrossMargin: round2(m.adjustedGrossMargin),
      bcr: m.bcr,
      roi: m.roi,
      avgYieldPerPlot: round2(m.yield),
      avgYieldPerHa: extrapolationFactor ? round2(m.yield * extrapolationFactor) : null,
      costPerKg: round2(m.costPerKg)
    };
  }

  const comparisons = [
    { key: 'grossRevenue', field: 'avgGrossRevenuePerPlot', mode: 'max', label: 'Higher Gross Revenue', unit: 'RWF' },
    { key: 'totalCost', field: 'avgTotalProductionCost', mode: 'min', label: 'Lower Production Cost', unit: 'RWF' },
    { key: 'netBenefit', field: 'netBenefit', mode: 'max', label: 'Higher Net Benefit', unit: 'RWF' },
    { key: 'bcr', field: 'bcr', mode: 'max', label: 'Better BCR', unit: '' },
    { key: 'yield', field: 'avgYieldPerPlot', mode: 'max', label: 'Higher Yield', unit: 'kg' }
  ];

  const winners = comparisons.map(({ field, mode, label, unit }) => {
    const winner = argExtreme(summary, field, mode);
    if (!winner) return { metric: label, sentence: `${label}: insufficient data.` };
    const [winnerLabel, winnerValues] = winner;
    const others = Object.entries(summary).filter(([l]) => l !== winnerLabel);
    const runnerUp = others.reduce((best, cur) => {
      if (!best) return cur;
      return mode === 'max' ? (cur[1][field] > best[1][field] ? cur : best) : cur[1][field] < best[1][field] ? cur : best;
    }, null);
    const delta = runnerUp ? Math.abs(winnerValues[field] - runnerUp[1][field]) : null;
    return {
      metric: label,
      winner: winnerLabel,
      sentence: `${winnerLabel} leads by ${delta !== null ? round2(delta) : 'n/a'}${unit ? ` ${unit}` : ''}`
    };
  });

  return { summary, comparisons: winners };
}

/** §6.2 — Cost structure: per-treatment component breakdown + C_SD/C_SI roll-up, each as amount + % of total. */
function computeCostStructure(componentTotalsByTreatment) {
  const result = {};
  for (const [label, components] of Object.entries(componentTotalsByTreatment)) {
    const { cSD = 0, cSI = 0, items = {} } = components;
    const total = cSD + cSI;
    result[label] = {
      total: round2(total),
      csdCsi: {
        C_SD: { amount: round2(cSD), pctOfTotal: total ? round2((cSD / total) * 100) : null },
        C_SI: { amount: round2(cSI), pctOfTotal: total ? round2((cSI / total) * 100) : null }
      },
      components: Object.fromEntries(
        Object.entries(items).map(([name, amount]) => [
          name,
          { amount: round2(amount), pctOfTotal: total ? round2((amount / total) * 100) : null }
        ])
      )
    };
  }
  return result;
}

function classifyRisk(cv) {
  if (cv < 10) return 'Low risk';
  if (cv < 20) return 'Moderate risk';
  return 'High risk';
}

/** §6.6 — Yield/Revenue stability & risk per treatment; pairwise "more stable" note when t=2. */
function computeYieldStabilityRisk(valuesByTreatment, alpha = 0.05) {
  const { jStat } = require('jstat');
  const perTreatment = {};
  for (const [label, rawValues] of Object.entries(valuesByTreatment)) {
    const values = rawValues.filter((v) => typeof v === 'number');
    const n = values.length;
    const m = mean(values);
    const variance = n > 1 ? values.reduce((a, v) => a + (v - m) ** 2, 0) / (n - 1) : 0;
    const sd = Math.sqrt(variance);
    const cv = m ? (sd / m) * 100 : 0;
    const sorted = [...values].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const median =
      n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[(n - 1) / 2];

    perTreatment[label] = {
      n,
      mean: round2(m),
      sd: round2(sd),
      variance: round2(variance),
      cv: round2(cv),
      cvClassification: classifyRisk(cv),
      min: round2(min),
      max: round2(max),
      range: round2(max - min),
      median: round2(median),
      downsideRiskPct: m ? round2((min / m) * 100) : null,
      probBelowAverage: n ? round2(values.filter((v) => v < m).length / n, 4) : null,
      _values: values,
      _variance: variance
    };
  }

  const labels = Object.keys(perTreatment);
  let pairwise = null;
  if (labels.length === 2) {
    const [a, b] = labels;
    const nA = perTreatment[a].n;
    const nB = perTreatment[b].n;
    const pooledVariance =
      ((nA - 1) * perTreatment[a]._variance + (nB - 1) * perTreatment[b]._variance) / (nA + nB - 2);
    const tCritical = jStat.studentt.inv(1 - alpha / 2, nA + nB - 2);
    const lsd = round2(tCritical * Math.sqrt(pooledVariance * (1 / nA + 1 / nB)));
    const moreStable = perTreatment[a].cv < perTreatment[b].cv ? `${a} more stable` : `${b} more stable`;
    pairwise = { lsd, moreStable };
  }

  for (const label of labels) {
    delete perTreatment[label]._values;
    delete perTreatment[label]._variance;
  }

  return { perTreatment, pairwise };
}

function classifySafety(margin) {
  if (margin === null || typeof margin === 'undefined') return null;
  if (margin > 0.2) return 'Strong';
  if (margin > 0.1) return 'Moderate';
  return 'Weak';
}

/**
 * §6.7 — Break-even analysis per treatment.
 * @param {Object<string, {totalCost:number, yieldKg:number}>} treatmentData
 * @param {number} marketPrice
 * @param {number} extrapolationFactor
 */
function computeBreakEven(treatmentData, marketPrice, extrapolationFactor) {
  const result = {};
  const safetyWins = {};
  for (const [label, { totalCost, yieldKg }] of Object.entries(treatmentData)) {
    const breakEvenYieldPlot = computeBreakEvenYield(totalCost, marketPrice);
    const breakEvenYieldHa = breakEvenYieldPlot !== null && extrapolationFactor ? round2(breakEvenYieldPlot * extrapolationFactor) : null;
    const yieldMarginOfSafety = computeYieldMarginOfSafety(yieldKg, breakEvenYieldPlot);
    const breakEvenPrice = computeCostPerKg(totalCost, yieldKg);
    const priceMarginOfSafety =
      breakEvenPrice !== null && marketPrice ? round2(((marketPrice - breakEvenPrice) / marketPrice) * 100) : null;

    result[label] = {
      breakEvenYieldPlot,
      breakEvenYieldHa,
      yieldMarginOfSafety,
      breakEvenPrice,
      priceMarginOfSafety,
      yieldSafetyClassification: classifySafety(yieldMarginOfSafety !== null ? yieldMarginOfSafety / 100 : null),
      priceSafetyClassification: classifySafety(priceMarginOfSafety !== null ? priceMarginOfSafety / 100 : null)
    };
    safetyWins[label] = 0;
  }

  const labels = Object.keys(result);
  for (const metric of ['yieldMarginOfSafety', 'priceMarginOfSafety']) {
    const winner = argExtreme(result, metric, 'max');
    if (winner) safetyWins[winner[0]] += 1;
  }
  const overallBest =
    labels.length > 0 ? labels.reduce((best, l) => (safetyWins[l] > safetyWins[best] ? l : best), labels[0]) : null;

  return { perTreatment: result, overallBest };
}

const DEFAULT_SCENARIO_SHOCKS = {
  pessimistic: { priceShockPct: -20, wageShockPct: 20 },
  expected: { priceShockPct: 0, wageShockPct: 0 },
  optimistic: { priceShockPct: 20, wageShockPct: -20 }
};

/**
 * §6.8 — Sensitivity scenario matrix. Only the labour-driven cost share
 * (C_SD, per the CP(i,t) convention) scales with the wage shock; C_SI is
 * held constant.
 * @param {Object<string, {yieldKg:number, cSD:number, cSI:number}>} treatmentData
 * @param {number} basePrice
 * @param {number} baseWage
 * @param {object} [shocks] - override defaults, same shape as DEFAULT_SCENARIO_SHOCKS
 */
function computeSensitivity(treatmentData, basePrice, baseWage, shocks = {}) {
  const scenarios = { ...DEFAULT_SCENARIO_SHOCKS, ...shocks };
  const results = {};

  for (const [scenarioName, { priceShockPct, wageShockPct }] of Object.entries(scenarios)) {
    const newPrice = basePrice * (1 + priceShockPct / 100);
    const newWage = baseWage * (1 + wageShockPct / 100);
    const wageFactor = baseWage ? newWage / baseWage : 1;

    results[scenarioName] = {};
    for (const [label, { yieldKg, cSD, cSI }] of Object.entries(treatmentData)) {
      const revenue = round2(yieldKg * newPrice);
      const cost = round2(cSI + cSD * wageFactor);
      const grossMargin = computeGrossMargin(revenue, cost);
      results[scenarioName][label] = {
        newPrice: round2(newPrice),
        newWage: round2(newWage),
        revenue,
        cost,
        grossMargin,
        bcr: computeBCR(revenue, cost),
        costPerKg: computeCostPerKg(cost, yieldKg),
        roi: grossMargin !== null ? computeROI(grossMargin, cost) : null
      };
    }
  }

  const winnerMatrix = {};
  const rankingsByScenario = {};
  for (const scenarioName of Object.keys(scenarios)) {
    const winner = argExtreme(results[scenarioName], 'grossMargin', 'max');
    winnerMatrix[scenarioName] = winner ? winner[0] : null;
    rankingsByScenario[scenarioName] = Object.entries(results[scenarioName])
      .sort((a, b) => (b[1].grossMargin ?? -Infinity) - (a[1].grossMargin ?? -Infinity))
      .map(([label]) => label);
  }
  const scenarioNames = Object.keys(scenarios);
  const stable = scenarioNames.every(
    (s) => JSON.stringify(rankingsByScenario[s]) === JSON.stringify(rankingsByScenario[scenarioNames[0]])
  );

  return {
    scenarios: results,
    winnerMatrix,
    rankingStable: stable,
    interpretation: stable
      ? 'The treatment ranking (by gross margin) is stable across all scenarios.'
      : 'The treatment ranking (by gross margin) changes depending on the scenario — the result is sensitive to price/wage assumptions.'
  };
}

/**
 * §6.9 — Partial budget (switching) analysis, baseline -> alternative.
 * Labour is netted into one line (per-practice labour swings are noisy
 * replicate-to-replicate and not individually decision-relevant); genuinely
 * new input items (present on one side only, e.g. CA-only mulch) get their
 * own acquisition-cost line; the overall C_SD cost differential is reported
 * as its own headline line — the system-dependent-cost delta a CA/CF
 * switching decision hinges on — alongside (not netted against) the above.
 * @param {object} params
 * @param {number} params.baselineRevenue
 * @param {number} params.alternativeRevenue
 * @param {Object<string, number>} params.baselineInputComponents - name -> amount
 * @param {Object<string, number>} params.alternativeInputComponents - name -> amount
 * @param {Object<string, number>} params.baselineLabourComponents - name -> amount
 * @param {Object<string, number>} params.alternativeLabourComponents - name -> amount
 * @param {number} params.baselineCSD
 * @param {number} params.alternativeCSD
 * @param {string} params.alternativeLabel
 * @param {number} [params.extrapolationFactor]
 */
function computePartialBudgetAnalysis({
  baselineRevenue,
  alternativeRevenue,
  baselineInputComponents,
  alternativeInputComponents,
  baselineLabourComponents,
  alternativeLabourComponents,
  baselineCSD,
  alternativeCSD,
  alternativeLabel,
  extrapolationFactor
}) {
  const benefitLines = [];
  const costLines = [];

  const additionalYieldRevenue = alternativeRevenue - baselineRevenue;
  if (additionalYieldRevenue > 0) benefitLines.push({ item: 'Additional yield revenue', amount: round2(additionalYieldRevenue) });

  const labourNames = new Set([...Object.keys(baselineLabourComponents), ...Object.keys(alternativeLabourComponents)]);
  let labourSavings = 0;
  for (const name of labourNames) {
    labourSavings += (baselineLabourComponents[name] || 0) - (alternativeLabourComponents[name] || 0);
  }
  if (labourSavings > 0) benefitLines.push({ item: 'Labour cost savings', amount: round2(labourSavings) });
  else if (labourSavings < 0) costLines.push({ item: 'Additional labour cost', amount: round2(-labourSavings) });

  const inputNames = new Set([...Object.keys(baselineInputComponents), ...Object.keys(alternativeInputComponents)]);
  for (const name of inputNames) {
    const baseAmt = baselineInputComponents[name] || 0;
    const altAmt = alternativeInputComponents[name] || 0;
    const delta = altAmt - baseAmt;
    if (delta > 0) costLines.push({ item: `${name} acquisition cost`, amount: round2(delta) });
    else if (delta < 0) benefitLines.push({ item: `${name} elimination savings`, amount: round2(-delta) });
  }

  const csdDifferential = alternativeCSD - baselineCSD;
  if (csdDifferential > 0) costLines.push({ item: 'System-dependent (C_SD) cost differential', amount: round2(csdDifferential) });
  else if (csdDifferential < 0) benefitLines.push({ item: 'System-dependent (C_SD) cost differential', amount: round2(-csdDifferential) });

  const additionalBenefits = benefitLines.reduce((s, l) => s + l.amount, 0);
  const additionalCosts = costLines.reduce((s, l) => s + l.amount, 0);
  const budget = computePartialBudget({ additionalBenefits, additionalCosts });

  const netChangePerHa = extrapolationFactor ? round2(budget.netChange * extrapolationFactor) : null;
  const recommendation =
    budget.netChange > 0
      ? `Adopt ${alternativeLabel}: net gain of ${Math.abs(budget.netChange)}/plot`
      : `Do not adopt ${alternativeLabel}: net loss of ${Math.abs(budget.netChange)}/plot`;

  return { benefitLines, costLines, ...budget, netChangePerHa, recommendation };
}

module.exports = {
  computeTrialConfigDerived,
  computePlotRollup,
  aggregateTreatments,
  computeCBASummary,
  computeCostStructure,
  computeYieldStabilityRisk,
  computeBreakEven,
  computeSensitivity,
  computePartialBudgetAnalysis,
  DEFAULT_SCENARIO_SHOCKS
};
