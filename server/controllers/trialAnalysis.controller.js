const Trial = require('../models/Trial');
const Treatment = require('../models/Treatment');
const TrialPlot = require('../models/TrialPlot');
const TrialYield = require('../models/TrialYield');
const { trialPlotCostBreakdown, trialPlotComponentTotals } = require('../services/trialPlotFinancials.service');
const {
  computePlotRollup,
  aggregateTreatments,
  computeCBASummary,
  computeCostStructure,
  computeYieldStabilityRisk,
  computeBreakEven,
  computeSensitivity,
  computePartialBudgetAnalysis
} = require('../engines/researchAnalysis.engine');
const { computeOneWayAnova, computePooledTTest } = require('../engines/statistical.engine');

function round2(n) {
  return typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function mean(values) {
  const vals = values.filter((v) => typeof v === 'number');
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

/**
 * Loads every plot of a trial with its cost breakdown, yield entry, and
 * per-plot roll-up, grouped by treatment and ordered by replicateNumber
 * (block order) — the shared data assembly every analysis endpoint needs.
 */
async function loadTrialData(trial) {
  const [treatments, plots] = await Promise.all([
    Treatment.find({ trialId: trial._id }).sort({ code: 1 }),
    TrialPlot.find({ trialId: trial._id }).sort({ replicateNumber: 1 })
  ]);

  const rows = await Promise.all(
    plots.map(async (plot) => {
      const [costBreakdown, yieldEntry] = await Promise.all([
        trialPlotCostBreakdown(plot._id),
        TrialYield.findOne({ trialPlotId: plot._id })
      ]);
      const rollup = computePlotRollup({
        costBreakdown,
        grossRevenueRwf: yieldEntry?.grossRevenueRwf,
        yieldKg: yieldEntry?.yieldKg,
        plotSizeM2: plot.plotSizeM2
      });
      return { plot, costBreakdown, yieldEntry, rollup };
    })
  );

  const treatmentById = new Map(treatments.map((t) => [String(t._id), t]));
  const rowsByTreatment = {};
  for (const row of rows) {
    const treatment = treatmentById.get(String(row.plot.treatmentId));
    if (!treatment) continue;
    if (!rowsByTreatment[treatment.code]) rowsByTreatment[treatment.code] = [];
    rowsByTreatment[treatment.code].push(row);
  }
  for (const code of Object.keys(rowsByTreatment)) {
    rowsByTreatment[code].sort((a, b) => a.plot.replicateNumber - b.plot.replicateNumber);
  }

  return { treatments, plots, rows, rowsByTreatment };
}

function seriesFor(rowsByTreatment, extractor) {
  const out = {};
  for (const [label, rows] of Object.entries(rowsByTreatment)) {
    out[label] = rows.map(extractor);
  }
  return out;
}

/**
 * Builds the per-variable series and the §6.1 CBA Summary from
 * rowsByTreatment — the one place this reduction happens, shared by
 * getTrialAnalysis and the Researcher Dashboard endpoint so the table and
 * the dashboard can never disagree.
 */
function buildCbaSummary(rowsByTreatment, labels, extrapolationFactor) {
  const yieldSeries = seriesFor(rowsByTreatment, (r) => r.yieldEntry?.yieldKg);
  const revenueSeries = seriesFor(rowsByTreatment, (r) => r.yieldEntry?.grossRevenueRwf);
  const totalCostSeries = seriesFor(rowsByTreatment, (r) => r.rollup.totalProductionCost);
  const cSDSeries = seriesFor(rowsByTreatment, (r) => r.rollup.cSDTotal);
  const cSISeries = seriesFor(rowsByTreatment, (r) => r.rollup.cSITotal);
  const netBenefitSeries = seriesFor(rowsByTreatment, (r) => r.rollup.netBenefit);

  const treatmentCba = {};
  for (const label of labels) {
    treatmentCba[label] = {
      grossRevenue: mean(revenueSeries[label]),
      totalCost: mean(totalCostSeries[label]),
      cSD: mean(cSDSeries[label]),
      cSI: mean(cSISeries[label]),
      yield: mean(yieldSeries[label])
    };
    treatmentCba[label].netBenefit = round2(treatmentCba[label].grossRevenue - treatmentCba[label].totalCost);
    treatmentCba[label].adjustedGrossMargin = round2(treatmentCba[label].grossRevenue - treatmentCba[label].cSD);
    // BCR/ROI are ratios, not RWF amounts — round2 here would lose precision
    // needed by consumers checking to ±0.0001 (e.g. capstone validation).
    treatmentCba[label].bcr = treatmentCba[label].totalCost
      ? treatmentCba[label].grossRevenue / treatmentCba[label].totalCost
      : null;
    treatmentCba[label].roi = treatmentCba[label].totalCost
      ? (treatmentCba[label].netBenefit / treatmentCba[label].totalCost) * 100
      : null;
    treatmentCba[label].costPerKg = treatmentCba[label].yield
      ? round2(treatmentCba[label].totalCost / treatmentCba[label].yield)
      : null;
  }
  const cbaSummary = computeCBASummary(treatmentCba, extrapolationFactor);

  return {
    cbaSummary,
    treatmentCba,
    series: { yieldSeries, revenueSeries, totalCostSeries, cSDSeries, cSISeries, netBenefitSeries }
  };
}

/** GET /trials/:trialId/analysis */
async function getTrialAnalysis(req, res, next) {
  try {
    const trial = await Trial.findById(req.params.trialId);
    if (!trial) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Trial not found.' } });
    }
    const { rowsByTreatment } = await loadTrialData(trial);
    const labels = Object.keys(rowsByTreatment);

    const incomplete = Object.values(rowsByTreatment)
      .flat()
      .filter((r) => typeof r.rollup.totalProductionCost !== 'number' || !r.yieldEntry);
    if (labels.length < 2 || incomplete.length > 0) {
      return res.status(422).json({
        error: {
          code: 'INSUFFICIENT_DATA',
          message: 'Every plot needs recorded costs and a yield entry, and at least 2 treatments are required.',
          field: 'plots'
        },
        missingPlotIds: incomplete.map((r) => r.plot._id)
      });
    }

    const alpha = trial.significanceLevel || 0.05;
    const extrapolationFactor = trial.computed?.extrapolationFactor;

    const {
      cbaSummary,
      treatmentCba,
      series: { yieldSeries, revenueSeries, totalCostSeries, cSDSeries, cSISeries, netBenefitSeries }
    } = buildCbaSummary(rowsByTreatment, labels, extrapolationFactor);

    // §4 — per-plot roll-ups.
    const plots = Object.values(rowsByTreatment)
      .flat()
      .map((r) => ({ plotId: r.plot._id, treatmentId: r.plot.treatmentId, replicateNumber: r.plot.replicateNumber, ...r.rollup }));

    // §5 — descriptive stats per variable.
    const descriptiveStats = {
      yield: aggregateTreatments(yieldSeries, alpha),
      grossRevenue: aggregateTreatments(revenueSeries, alpha),
      totalProductionCost: aggregateTreatments(totalCostSeries, alpha),
      cSD: aggregateTreatments(cSDSeries, alpha),
      cSI: aggregateTreatments(cSISeries, alpha),
      netBenefit: aggregateTreatments(netBenefitSeries, alpha)
    };

    // §6.2 — Cost structure, component totals per treatment.
    const componentTotalsByTreatment = {};
    for (const label of labels) {
      const plotIds = rowsByTreatment[label].map((r) => r.plot._id);
      componentTotalsByTreatment[label] = await trialPlotComponentTotals(plotIds);
    }
    const costStructure = computeCostStructure(componentTotalsByTreatment);

    // §6.4/§6.5 — RCBD ANOVA (+ pooled t-test when t=2) per response variable.
    const variableSeries = {
      yield: yieldSeries,
      grossRevenue: revenueSeries,
      totalProductionCost: totalCostSeries,
      cSD: cSDSeries,
      cSI: cSISeries,
      netBenefit: netBenefitSeries
    };
    const anova = {};
    const tTest = labels.length === 2 ? {} : null;
    for (const [variable, series] of Object.entries(variableSeries)) {
      anova[variable] = computeOneWayAnova(series, alpha);
      if (tTest) {
        tTest[variable] = computePooledTTest(
          { label: labels[0], values: series[labels[0]] },
          { label: labels[1], values: series[labels[1]] },
          alpha
        );
      }
    }

    // §6.6 — Yield & Revenue stability/risk.
    const riskStability = {
      yield: computeYieldStabilityRisk(yieldSeries, alpha),
      revenue: computeYieldStabilityRisk(revenueSeries, alpha)
    };

    // §6.7 — Break-even.
    const breakEvenInputs = {};
    for (const label of labels) {
      breakEvenInputs[label] = { totalCost: treatmentCba[label].totalCost, yieldKg: treatmentCba[label].yield };
    }
    const breakEven = computeBreakEven(breakEvenInputs, trial.marketPriceRwfPerKg, extrapolationFactor);

    // §6.8 — Sensitivity (default shocks).
    const sensitivityInputs = {};
    for (const label of labels) {
      sensitivityInputs[label] = {
        yieldKg: treatmentCba[label].yield,
        cSD: treatmentCba[label].cSD,
        cSI: treatmentCba[label].cSI
      };
    }
    const sensitivity = computeSensitivity(sensitivityInputs, trial.marketPriceRwfPerKg, trial.wageRatePerDayRwf);

    res.json({
      trial,
      config: trial.computed,
      plots,
      descriptiveStats,
      cbaSummary,
      costStructure,
      anova,
      tTest,
      riskStability,
      breakEven,
      sensitivity
    });
  } catch (err) {
    next(err);
  }
}

/** POST /trials/:trialId/sensitivity — body: { priceShockPct, wageShockPct } per scenario, overriding defaults. */
async function postTrialSensitivity(req, res, next) {
  try {
    const trial = await Trial.findById(req.params.trialId);
    if (!trial) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Trial not found.' } });
    }
    const { rowsByTreatment } = await loadTrialData(trial);
    const labels = Object.keys(rowsByTreatment);

    const yieldSeries = seriesFor(rowsByTreatment, (r) => r.yieldEntry?.yieldKg);
    const cSDSeries = seriesFor(rowsByTreatment, (r) => r.rollup.cSDTotal);
    const cSISeries = seriesFor(rowsByTreatment, (r) => r.rollup.cSITotal);

    const sensitivityInputs = {};
    for (const label of labels) {
      sensitivityInputs[label] = { yieldKg: mean(yieldSeries[label]), cSD: mean(cSDSeries[label]), cSI: mean(cSISeries[label]) };
    }

    const shocks = req.body || {};
    const sensitivity = computeSensitivity(sensitivityInputs, trial.marketPriceRwfPerKg, trial.wageRatePerDayRwf, shocks);
    res.json({ sensitivity });
  } catch (err) {
    next(err);
  }
}

/** POST /trials/:trialId/partial-budget — body: { baselineTreatmentId, alternativeTreatmentId }. */
async function postTrialPartialBudget(req, res, next) {
  try {
    const trial = await Trial.findById(req.params.trialId);
    if (!trial) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Trial not found.' } });
    }
    const { baselineTreatmentId, alternativeTreatmentId } = req.body || {};
    if (!baselineTreatmentId || !alternativeTreatmentId) {
      return res.status(400).json({
        error: { code: 'MISSING_PARAM', message: 'Both baselineTreatmentId and alternativeTreatmentId are required.' }
      });
    }

    const [baseline, alternative] = await Promise.all([
      Treatment.findById(baselineTreatmentId),
      Treatment.findById(alternativeTreatmentId)
    ]);
    if (!baseline || !alternative || String(baseline.trialId) !== String(trial._id) || String(alternative.trialId) !== String(trial._id)) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Treatment(s) not found on this trial.' } });
    }

    const { rowsByTreatment } = await loadTrialData(trial);
    const baselineRows = rowsByTreatment[baseline.code] || [];
    const alternativeRows = rowsByTreatment[alternative.code] || [];
    if (baselineRows.length === 0 || alternativeRows.length === 0) {
      return res.status(422).json({ error: { code: 'INSUFFICIENT_DATA', message: 'Both treatments need recorded plot data.' } });
    }

    const baselineRevenue = mean(baselineRows.map((r) => r.yieldEntry?.grossRevenueRwf));
    const alternativeRevenue = mean(alternativeRows.map((r) => r.yieldEntry?.grossRevenueRwf));

    const [baselineComponents, alternativeComponents] = await Promise.all([
      trialPlotComponentTotals(baselineRows.map((r) => r.plot._id)),
      trialPlotComponentTotals(alternativeRows.map((r) => r.plot._id))
    ]);
    const perPlotMean = (items, count) =>
      Object.fromEntries(Object.entries(items).map(([name, total]) => [name, count ? total / count : 0]));

    const partialBudget = computePartialBudgetAnalysis({
      baselineRevenue,
      alternativeRevenue,
      baselineInputComponents: perPlotMean(baselineComponents.inputItems, baselineRows.length),
      alternativeInputComponents: perPlotMean(alternativeComponents.inputItems, alternativeRows.length),
      baselineLabourComponents: perPlotMean(baselineComponents.labourItems, baselineRows.length),
      alternativeLabourComponents: perPlotMean(alternativeComponents.labourItems, alternativeRows.length),
      baselineCSD: baselineComponents.cSD / baselineRows.length,
      alternativeCSD: alternativeComponents.cSD / alternativeRows.length,
      alternativeLabel: alternative.label,
      extrapolationFactor: trial.computed?.extrapolationFactor
    });

    res.json({ partialBudget });
  } catch (err) {
    next(err);
  }
}

module.exports = { getTrialAnalysis, postTrialSensitivity, postTrialPartialBudget, loadTrialData, buildCbaSummary, seriesFor };
