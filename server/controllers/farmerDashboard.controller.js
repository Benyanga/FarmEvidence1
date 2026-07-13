const Season = require('../models/Season');
const Setup = require('../models/Setup');
const Plot = require('../models/Plot');
const AgronomicRecord = require('../models/AgronomicRecord');
const CostRecord = require('../models/CostRecord');
const LaborRecord = require('../models/LaborRecord');
const YieldRecord = require('../models/YieldRecord');
const { computeAdoptionGap } = require('../engines/cba.engine');
const { plotComponentTotals } = require('../services/plotFinancials.service');
const { computeSeasonCore, buildSeasonSeries } = require('./compute.controller');

const ESTABLISHED_AT_SEASON = 7;
const GATE_COUNT = 4;

function round2(n) {
  return typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/** How many consecutive CA seasons (ending at this one) this farm has recorded — used for the phase badge. */
function countConsecutiveCASeasons(series, uptoSeasonNumber) {
  const sorted = series.filter((s) => s.season <= uptoSeasonNumber).sort((a, b) => b.season - a.season);
  let count = 0;
  for (const s of sorted) {
    if (s.farmingSystem !== 'CA') break;
    count += 1;
  }
  return count;
}

/** The farm's most recent CF-season profit strictly before this season — the adoption-gap baseline. */
function findPriorCFBaseline(series, uptoSeasonNumber) {
  const prior = series.filter((s) => s.season < uptoSeasonNumber && s.farmingSystem === 'CF').sort((a, b) => b.season - a.season);
  return prior.length ? prior[0].seasonProfit : null;
}

async function buildAlerts({ season, plot, priorPlot, soilNow, soilPrior, adoptionGap, priorAdoptionGap }) {
  const alerts = [];
  const c = plot.computed || {};
  const p = priorPlot?.computed || {};

  if (typeof c.cSystem === 'number' && typeof p.cSystem === 'number' && p.cSystem > 0) {
    const laborDeltaPct = ((c.cSystem - p.cSystem) / p.cSystem) * 100;
    if (laborDeltaPct < -5) {
      alerts.push({ sev: 'g', text: `Production cost fell ${Math.abs(round2(laborDeltaPct))}% vs last season.` });
    } else if (laborDeltaPct > 5) {
      alerts.push({ sev: 'a', text: `Production cost rose ${round2(laborDeltaPct)}% vs last season.` });
    }
  }

  if (soilNow?.weedPressureScore?.value != null && soilPrior?.weedPressureScore?.value != null) {
    const nowScore = round2(soilNow.weedPressureScore.value);
    const priorScore = round2(soilPrior.weedPressureScore.value);
    const delta = nowScore - priorScore;
    if (delta > 0) {
      alerts.push({ sev: 'a', text: `Weed pressure rose from score ${priorScore} to score ${nowScore} this season.` });
    } else if (delta < 0) {
      alerts.push({ sev: 'g', text: `Weed pressure fell from score ${priorScore} to score ${nowScore} this season.` });
    }
  }
  if (soilNow?.earthwormCount?.value != null && soilPrior?.earthwormCount?.value != null && soilNow.earthwormCount.value > soilPrior.earthwormCount.value) {
    alerts.push({ sev: 'g', text: `Earthworm count rose from ${soilPrior.earthwormCount.value} to ${soilNow.earthwormCount.value} — soil biological activity improving.` });
  }

  if (adoptionGap != null && priorAdoptionGap != null && adoptionGap < priorAdoptionGap) {
    alerts.push({ sev: 'n', text: `Adoption gap narrowed by ${round2(priorAdoptionGap - adoptionGap).toLocaleString()} RWF/ha this season.` });
  } else if (adoptionGap != null && priorAdoptionGap == null) {
    alerts.push({ sev: 'n', text: 'First recorded CA season on this farm — this becomes the baseline for future comparisons.' });
  }

  if (alerts.length === 0) alerts.push({ sev: 'n', text: 'No notable deviations this season.' });
  return alerts;
}

/** GET /seasons/:id/dashboard — Farmer Mode only. Always 200; recomputes fresh, same as CBADashboard's auto-run. */
async function getFarmerDashboard(req, res, next) {
  try {
    const season = await Season.findById(req.params.id);
    if (!season) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Season not found.' } });
    }
    const setup = await Setup.findById(season.setupId);
    if (!setup) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Setup not found.' } });
    }

    await computeSeasonCore(season, setup, req);
    const plot = await Plot.find({ seasonId: season._id }).then((p) => p[0]);

    const series = await buildSeasonSeries(setup._id);
    const priorSeriesEntry = series.find((s) => s.season === season.seasonNumber - 1);
    const priorSeason = priorSeriesEntry ? await Season.findOne({ setupId: setup._id, seasonNumber: season.seasonNumber - 1 }) : null;
    const priorPlot = priorSeason ? await Plot.find({ seasonId: priorSeason._id }).then((p) => p[0]) : null;

    // Gates: real 4-section data-entry completion for this season's plot.
    const [costCount, laborCount, agronomicCount, yieldCount] = await Promise.all([
      CostRecord.countDocuments({ plotId: plot._id }),
      LaborRecord.countDocuments({ plotId: plot._id }),
      AgronomicRecord.countDocuments({ plotId: plot._id }),
      YieldRecord.countDocuments({ plotId: plot._id })
    ]);
    const gatesFilled = [costCount, laborCount, agronomicCount, yieldCount].filter((n) => n > 0).length;

    // Phase — derived from consecutive CA-season count, since engine's computed.phase is never populated.
    let phase = null;
    if (season.farmingSystem === 'CA') {
      const n = countConsecutiveCASeasons(series, season.seasonNumber);
      phase = { seasonNumber: n, established: n >= ESTABLISHED_AT_SEASON };
    }

    // Adoption gap — only when a prior CF baseline exists for this farm.
    let adoptionGap = null;
    let priorAdoptionGap = null;
    if (season.farmingSystem === 'CA') {
      const baseline = findPriorCFBaseline(series, season.seasonNumber);
      if (baseline != null) {
        adoptionGap = computeAdoptionGap(plot.computed?.profit, baseline);
        if (priorSeriesEntry?.farmingSystem === 'CA') {
          const priorBaseline = findPriorCFBaseline(series, season.seasonNumber - 1);
          if (priorBaseline != null) priorAdoptionGap = computeAdoptionGap(priorPlot?.computed?.profit, priorBaseline);
        }
      }
    }

    const costBreakdown = await plotComponentTotals(plot._id);

    const soilNow = await AgronomicRecord.findOne({ plotId: plot._id }).sort({ observationDate: -1, createdAt: -1 });
    const soilPrior = priorPlot ? await AgronomicRecord.findOne({ plotId: priorPlot._id }).sort({ observationDate: -1, createdAt: -1 }) : null;

    const alerts = await buildAlerts({ season, plot, priorPlot, soilNow, soilPrior, adoptionGap, priorAdoptionGap });

    res.json({
      season,
      setup,
      plot,
      priorPlot: priorPlot ? { computed: priorPlot.computed } : null,
      gates: { total: GATE_COUNT, filled: gatesFilled },
      phase,
      adoptionGap: adoptionGap != null ? { value: adoptionGap, priorValue: priorAdoptionGap } : null,
      costBreakdown,
      soilHealth: soilNow || null,
      seasonHistory: series.map((s) => ({ season: s.season, farmingSystem: s.farmingSystem, profit: s.seasonProfit })),
      alerts
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getFarmerDashboard };
