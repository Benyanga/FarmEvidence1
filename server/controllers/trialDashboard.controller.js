const Trial = require('../models/Trial');
const Season = require('../models/Season');
const Setup = require('../models/Setup');
const { trialPlotComponentTotals } = require('../services/trialPlotFinancials.service');
const { computeCostStructure } = require('../engines/researchAnalysis.engine');
const { computePooledTTest, computeEffectSize } = require('../engines/statistical.engine');
const { loadTrialData, buildCbaSummary } = require('./trialAnalysis.controller');
const { getPlotCode } = require('../utils/plotCode');

const COMPARISON_ROWS = [
  { key: 'netBenefit', label: 'Profit', unit: 'RWF' },
  { key: 'avgGrossRevenuePerHa', label: 'Revenue', unit: 'RWF' },
  { key: 'avgCSI', label: 'System costs', unit: 'RWF' },
  { key: 'avgCSD', label: 'Labour cost', unit: 'RWF' },
  { key: 'avgYieldPerHa', label: 'Yield', unit: 'kg' },
  { key: 'bcr', label: 'Benefit-cost ratio', unit: '' },
  { key: 'roi', label: 'ROI', unit: '%' },
  { key: 'costPerKg', label: 'Cost per kg', unit: 'RWF' }
];
// Lower value is the favourable direction for these metrics; every other row is "higher is better".
const LOWER_IS_BETTER = new Set(['avgCSI', 'avgCSD', 'costPerKg']);

function round2(n) {
  return typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/** 3-gate plot completion: recorded input cost, recorded labour cost, recorded yield. */
function plotGateStatus(row) {
  const gates = [row.costBreakdown.inputCostTotal > 0, row.costBreakdown.laborCostTotal > 0, Boolean(row.yieldEntry)];
  const gatesFilled = gates.filter(Boolean).length;
  const status = gatesFilled === 3 ? 'complete' : gatesFilled === 0 ? 'not_started' : 'partial';
  return { gatesFilled, status };
}

function buildComparison(cbaSummary) {
  // Always CA then CF — never the incidental order plots were loaded in —
  // so the comparison table's columns and colors are stable every render.
  const labels = ['CA', 'CF'].filter((code) => cbaSummary.summary[code]);
  if (labels.length !== 2) return null;
  const [a, b] = labels;
  const rows = COMPARISON_ROWS.map(({ key, label, unit }) => {
    const valA = cbaSummary.summary[a][key];
    const valB = cbaSummary.summary[b][key];
    if (typeof valA !== 'number' || typeof valB !== 'number') return { metric: label, values: { [a]: valA, [b]: valB }, best: null, delta: null };
    const lowerBetter = LOWER_IS_BETTER.has(key);
    const best = valA === valB ? null : (lowerBetter ? valA < valB : valA > valB) ? a : b;
    const delta = round2(Math.abs(valA - valB));
    return { metric: label, unit, values: { [a]: valA, [b]: valB }, best, delta };
  });

  const profitRow = rows.find((r) => r.metric === 'Profit');
  const deltaSentence =
    profitRow && profitRow.best
      ? `${profitRow.best} ${LOWER_IS_BETTER.has('netBenefit') ? 'saves' : 'earns'} ${profitRow.delta.toLocaleString()} RWF/ha more than ${
          profitRow.best === a ? b : a
        } this season`
      : null;

  return { treatmentLabels: [a, b], rows, deltaSentence };
}

function buildAlerts({ comparison, statisticalResult }) {
  const alerts = [];
  if (!comparison) {
    return [{ severity: 'a', text: 'Alerts appear once every plot has recorded costs and a yield entry.' }];
  }

  const relDelta = (row) => {
    const vals = Object.values(row.values).filter((v) => typeof v === 'number');
    if (vals.length !== 2 || row.delta === null) return 0;
    const denom = Math.max(...vals.map(Math.abs));
    return denom ? row.delta / denom : 0;
  };

  const profit = comparison.rows.find((r) => r.metric === 'Profit');
  if (profit && profit.best && relDelta(profit) > 0.05) {
    const other = comparison.treatmentLabels.find((l) => l !== profit.best);
    alerts.push({
      severity: 'g',
      text: `${profit.best} profit exceeded ${other} by ${profit.delta.toLocaleString()} RWF/ha this season.`
    });
  }

  const labour = comparison.rows.find((r) => r.metric === 'Labour cost');
  if (labour && labour.best && relDelta(labour) > 0.05) {
    const other = comparison.treatmentLabels.find((l) => l !== labour.best);
    alerts.push({
      severity: 'g',
      text: `${labour.best} saved ${labour.delta.toLocaleString()} RWF/ha on labour vs ${other}.`
    });
  }

  const yieldRow = comparison.rows.find((r) => r.metric === 'Yield');
  if (yieldRow && yieldRow.best && relDelta(yieldRow) > 0.05) {
    const other = comparison.treatmentLabels.find((l) => l !== yieldRow.best);
    alerts.push({
      severity: 'a',
      text: `${yieldRow.best} yield exceeded ${other} by ${yieldRow.delta.toLocaleString()} kg/ha this season.`
    });
  }

  if (statisticalResult && statisticalResult.canCompute) {
    alerts.push({
      severity: statisticalResult.significant ? 'g' : 'a',
      text: statisticalResult.significant
        ? `Profit difference between treatments is statistically significant (p=${statisticalResult.pValue}).`
        : `No statistically significant profit difference yet (p=${statisticalResult.pValue}) — more replications may help.`
    });
  }

  if (alerts.length === 0) alerts.push({ severity: 'g', text: 'No notable deviations this season.' });
  return alerts;
}

/** GET /trials/:trialId/dashboard — always 200, even with incomplete data, so the dashboard can show partial state. */
async function getTrialDashboard(req, res, next) {
  try {
    const trial = await Trial.findById(req.params.trialId);
    if (!trial) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Trial not found.' } });
    }
    const [season, setup] = await Promise.all([Season.findById(trial.seasonId), Setup.findById(trial.setupId)]);
    const { treatments, rows, rowsByTreatment } = await loadTrialData(trial);
    const treatmentById = new Map(treatments.map((t) => [String(t._id), t]));

    const plotStatus = rows.map((r) => {
      const treatment = treatmentById.get(String(r.plot.treatmentId));
      const { gatesFilled, status } = plotGateStatus(r);
      return {
        plotId: r.plot._id,
        plotCode: getPlotCode(treatment?.code, r.plot.replicateNumber),
        treatmentCode: treatment?.code,
        replicateNumber: r.plot.replicateNumber,
        gatesFilled,
        status
      };
    });
    plotStatus.sort((a, b) => a.treatmentCode.localeCompare(b.treatmentCode) || a.replicateNumber - b.replicateNumber);

    const recorded = plotStatus.filter((p) => p.status === 'complete').length;
    const expected = plotStatus.length;
    const pendingCount = expected - recorded;
    const statusRow = { recorded, expected, computed: pendingCount === 0 && expected > 0, pendingCount };

    let comparison = null;
    let statisticalResult = null;
    let costBreakdown = null;
    // Always CA then CF, never the incidental order plots were loaded in.
    const labels = ['CA', 'CF'].filter((code) => rowsByTreatment[code]);

    if (pendingCount === 0 && expected > 0 && labels.length === 2) {
      const alpha = trial.significanceLevel || 0.05;
      const extrapolationFactor = trial.computed?.extrapolationFactor;
      const {
        cbaSummary,
        series: { netBenefitSeries }
      } = buildCbaSummary(rowsByTreatment, labels, extrapolationFactor);
      comparison = buildComparison(cbaSummary);

      const tTest = computePooledTTest(
        { label: labels[0], values: netBenefitSeries[labels[0]] },
        { label: labels[1], values: netBenefitSeries[labels[1]] },
        alpha
      );
      statisticalResult = tTest.canCompute
        ? { ...tTest, ...computeEffectSize(tTest), replications: netBenefitSeries[labels[0]].length }
        : tTest;

      const componentTotalsByTreatment = {};
      for (const label of labels) {
        const plotIds = rowsByTreatment[label].map((r) => r.plot._id);
        componentTotalsByTreatment[label] = await trialPlotComponentTotals(plotIds);
      }
      costBreakdown = computeCostStructure(componentTotalsByTreatment);
    }

    const alerts = buildAlerts({ comparison, statisticalResult });

    res.json({
      trial,
      season,
      setup,
      treatments,
      plotStatus,
      statusRow,
      comparison,
      statisticalResult,
      costBreakdown,
      alerts
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getTrialDashboard };
