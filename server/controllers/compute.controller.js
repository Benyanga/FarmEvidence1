const Season = require('../models/Season');
const Setup = require('../models/Setup');
const Plot = require('../models/Plot');
const AgronomicRecord = require('../models/AgronomicRecord');

const {
  computePlotCBA,
  computeFarmerAdoptionCost,
  computeGrossMargin,
  computeAdjustedGrossMargin,
  computeBCR,
  computeROI,
  computeCostPerKg,
  computeBreakEvenYield,
  computeYieldMarginOfSafety
} = require('../engines/cba.engine');
const { computeScenarios } = require('../engines/scenario.engine');
const { computeTrend, TRACKED_INDICATORS } = require('../engines/trend.engine');
const { explainProfit, explainAdoptionCost, explainScenario, explainTrend } = require('../engines/explainability.engine');
const { checkConditionNotifications } = require('../services/notification.service');
const { plotCostBreakdown, plotYieldSummary } = require('../services/plotFinancials.service');

function mean(arr) {
  const vals = arr.filter((v) => typeof v === 'number');
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/**
 * Builds the raw per-season series for a Farmer Mode setup (used by trend
 * charts). Each season has exactly one farmingSystem, so only the matching
 * CA/CF field is populated for that season — the other is null.
 */
async function buildSeasonSeries(setupId) {
  const seasons = await Season.find({ setupId }).sort({ seasonNumber: 1 });
  const series = [];

  for (const season of seasons) {
    const plots = await Plot.find({ seasonId: season._id });
    const profits = plots.map((p) => p.computed?.profit);
    const yields = plots.map((p) => p.yield?.value);
    const adoptionCosts = plots.map((p) => p.computed?.adoptionCost);
    const isCA = season.farmingSystem === 'CA';

    const agronomic = await AgronomicRecord.find({ seasonId: season._id });
    const agronomicMeans = {
      biomassYield: mean(agronomic.map((a) => a.biomassYield?.value)),
      grainYield: mean(agronomic.map((a) => a.grainYield?.value)),
      soilOrganicCarbon: mean(agronomic.map((a) => a.soilOrganicCarbon?.value)),
      soilMoisture: mean(agronomic.map((a) => a.soilMoisture?.value)),
      plantHeight: mean(agronomic.map((a) => a.plantHeight?.value)),
      leafAreaIndex: mean(agronomic.map((a) => a.leafAreaIndex?.value)),
      erosionScore: mean(agronomic.map((a) => a.erosionScore?.value))
    };

    series.push({
      season: season.seasonNumber,
      farmingSystem: season.farmingSystem,
      profitCA: isCA ? mean(profits) : null,
      profitCF: !isCA ? mean(profits) : null,
      yieldCA: isCA ? mean(yields) : null,
      yieldCF: !isCA ? mean(yields) : null,
      seasonProfit: mean(profits),
      adoptionCost: mean(adoptionCosts),
      csi: season.computed?.csi ?? null,
      ...agronomicMeans
    });
  }

  return series;
}

/**
 * Shared core: recomputes every plot of a season (CBA, adoption cost,
 * trends), persists the results, and fires condition notifications — the
 * one place this happens, reused by both the explicit "Run Computation"
 * route and the Farmer Dashboard (which needs the same fresh numbers on
 * every view, same as CBADashboard already does today via its auto-run
 * effect). Returns everything the route handler's res.json needs.
 */
async function computeSeasonCore(season, setup, req) {
    const plots = await Plot.find({ seasonId: season._id });
    const plotResults = [];

    for (const plot of plots) {
      const costBreakdown = await plotCostBreakdown(plot._id);
      const yieldSummary = await plotYieldSummary(plot._id);
      const revenueOverride = yieldSummary.totalRevenue;
      const yieldOverride = yieldSummary.totalHarvested;
      const priceForIndicators = yieldSummary.lastPrice ?? plot.sellingPrice?.value ?? null;

      const cba = computePlotCBA({
        cBase: costBreakdown.total,
        farmingSystem: season.farmingSystem,
        yield: plot.yield,
        sellingPrice: plot.sellingPrice,
        revenueOverride,
        yieldOverride
      });

      const grossMargin = computeGrossMargin(cba.revenue, cba.cSystem);
      const adjustedGrossMargin = computeAdjustedGrossMargin(cba.revenue, costBreakdown.cSD);
      const bcr = computeBCR(cba.revenue, cba.cSystem);
      const roi = computeROI(grossMargin, cba.cSystem);
      const costPerKg = computeCostPerKg(cba.cSystem, cba.yieldValue);
      const breakEvenYield = computeBreakEvenYield(cba.cSystem, priceForIndicators);
      const yieldMarginOfSafety = computeYieldMarginOfSafety(cba.yieldValue, breakEvenYield);

      plot.computed = {
        cBase: cba.cBase,
        cSD: costBreakdown.cSD,
        cSI: costBreakdown.cSI,
        cSys: cba.cSys,
        cTime: cba.cTime,
        cSystem: cba.cSystem,
        profit: cba.profit,
        grossMargin,
        adjustedGrossMargin,
        bcr,
        roi,
        costPerKg,
        breakEvenYield,
        yieldMarginOfSafety,
        adoptionCost: plot.computed?.adoptionCost ?? null,
        canCompute: cba.canCompute,
        missingData: cba.missingData
      };
      plot.revenue = cba.revenue;
      if (typeof yieldOverride === 'number') {
        plot.yield = { value: yieldOverride, unit: 'kg', isObserved: true };
      }

      await plot.save();
      plotResults.push({ plot, cba, costBreakdown });
    }

    const meanSeasonProfit = mean(plots.map((p) => p.computed?.profit));

    // Adoption cost — only on system-change seasons.
    let adoptionCost = null;
    const isChangeSeason = season.seasonNumber === setup.adoptionStartSeason && season.farmingSystem === 'CA';
    if (isChangeSeason) {
      const prevSeason = await Season.findOne({ setupId: setup._id, seasonNumber: season.seasonNumber - 1 });
      let profitPrev = null;
      if (prevSeason) {
        const prevPlots = await Plot.find({ seasonId: prevSeason._id });
        profitPrev = mean(prevPlots.map((p) => p.computed?.profit));
      }
      adoptionCost = computeFarmerAdoptionCost(profitPrev, meanSeasonProfit, true);
    }
    for (const plot of plots) {
      plot.computed.adoptionCost = isChangeSeason ? adoptionCost : 0;
      await plot.save();
    }

    const rawSeries = await buildSeasonSeries(setup._id);
    const upToNow = rawSeries.filter((s) => s.season <= season.seasonNumber);

    const trendIndicators = {
      profitCA: computeTrend('profit_CA', upToNow.map((s) => ({ season: s.season, value: s.profitCA }))),
      profitCF: computeTrend('profit_CF', upToNow.map((s) => ({ season: s.season, value: s.profitCF }))),
      yieldCA: computeTrend('yield_CA', upToNow.map((s) => ({ season: s.season, value: s.yieldCA }))),
      yieldCF: computeTrend('yield_CF', upToNow.map((s) => ({ season: s.season, value: s.yieldCF }))),
      adoptionCost: computeTrend('adoptionCost', upToNow.map((s) => ({ season: s.season, value: s.adoptionCost })))
    };

    season.computed = {
      csi: null,
      phase: null,
      phi: 0,
      trends: {
        profitCA: trendIndicators.profitCA.classification,
        profitCF: trendIndicators.profitCF.classification,
        yieldCA: trendIndicators.yieldCA.classification,
        yieldCF: trendIndicators.yieldCF.classification,
        adoptionCost: trendIndicators.adoptionCost.classification
      }
    };
    await season.save();

    await checkConditionNotifications({
      userId: req.dbUser._id,
      setup,
      season,
      plots,
      trendSeries: upToNow.map((s) => s.seasonProfit).filter((v) => typeof v === 'number')
    });

    const responsePlots = plotResults.map(({ plot, cba, costBreakdown }) => ({
      plotId: plot._id,
      farmingSystem: season.farmingSystem,
      replicationNumber: plot.replicationNumber,
      cBase: cba.cBase,
      cSD: costBreakdown.cSD,
      cSI: costBreakdown.cSI,
      cSystem: cba.cSystem,
      revenue: cba.revenue,
      profit: cba.profit,
      grossMargin: plot.computed.grossMargin,
      adjustedGrossMargin: plot.computed.adjustedGrossMargin,
      bcr: plot.computed.bcr,
      roi: plot.computed.roi,
      costPerKg: plot.computed.costPerKg,
      breakEvenYield: plot.computed.breakEvenYield,
      yieldMarginOfSafety: plot.computed.yieldMarginOfSafety,
      adoptionCost: plot.computed.adoptionCost,
      canCompute: cba.canCompute,
      missingData: cba.missingData,
      explanation: explainProfit({
        treatment: season.farmingSystem,
        season: season.seasonNumber,
        profit: cba.profit,
        revenue: cba.revenue,
        cSystem: cba.cSystem,
        cBase: cba.cBase,
        cSys: cba.cSys,
        cTime: cba.cTime,
        missingData: cba.missingData,
        isResearch: false
      })
    }));

    return {
      seasonId: season._id,
      farmingSystem: season.farmingSystem,
      plots: responsePlots,
      meanSeasonProfit,
      adoptionCost,
      adoptionCostExplanation: explainAdoptionCost({
        mode: 'farmer',
        adoptionCost,
        profitCA: season.farmingSystem === 'CA' ? meanSeasonProfit : null,
        profitCF: season.farmingSystem === 'CF' ? meanSeasonProfit : null
      }),
      trends: season.computed.trends
    };
}

/**
 * POST /compute/season/:seasonId — Farmer Mode only (modeGuard). Research
 * Mode's computation lives under /trials/:trialId/analysis instead (see
 * trialAnalysis.controller.js).
 */
async function computeSeason(req, res, next) {
  try {
    const season = await Season.findById(req.params.seasonId);
    if (!season) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Season not found.' } });
    }
    const setup = await Setup.findById(season.setupId);
    if (!setup) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Setup not found.' } });
    }

    const result = await computeSeasonCore(season, setup, req);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/** POST /compute/scenarios/:plotId */
async function computeScenariosRoute(req, res, next) {
  try {
    const plot = await Plot.findById(req.params.plotId);
    if (!plot) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Plot not found.' } });
    }
    const season = await Season.findById(plot.seasonId);

    if (!plot.yield?.value || !plot.sellingPrice?.value || typeof plot.computed?.cSystem !== 'number') {
      return res.status(422).json({
        error: {
          code: 'MISSING_CBA_RESULT',
          message: 'Run /compute/season for this plot before generating scenarios.',
          field: 'computed.cSystem'
        }
      });
    }

    const result = computeScenarios({
      yieldValue: plot.yield.value,
      price: plot.sellingPrice.value,
      cSystem: plot.computed.cSystem,
      csi: season?.computed?.csi ?? 0,
      overrides: req.body || {}
    });

    res.json({
      ...result,
      explanation: explainScenario({ scenarios: result.scenarios, expectedProfit: result.expectedProfit, csi: season?.computed?.csi ?? 0 })
    });
  } catch (err) {
    next(err);
  }
}

/** POST /compute/trends/:setupId */
async function computeTrendsRoute(req, res, next) {
  try {
    const series = await buildSeasonSeries(req.params.setupId);

    const indicatorSeries = {
      profit_CA: series.map((s) => ({ season: s.season, value: s.profitCA })),
      profit_CF: series.map((s) => ({ season: s.season, value: s.profitCF })),
      yield_CA: series.map((s) => ({ season: s.season, value: s.yieldCA })),
      yield_CF: series.map((s) => ({ season: s.season, value: s.yieldCF })),
      adoptionCost: series.map((s) => ({ season: s.season, value: s.adoptionCost })),
      csi: series.map((s) => ({ season: s.season, value: s.csi })),
      biomassYield: series.map((s) => ({ season: s.season, value: s.biomassYield })),
      grainYield: series.map((s) => ({ season: s.season, value: s.grainYield })),
      soilOrganicCarbon: series.map((s) => ({ season: s.season, value: s.soilOrganicCarbon })),
      soilMoisture: series.map((s) => ({ season: s.season, value: s.soilMoisture })),
      plantHeight: series.map((s) => ({ season: s.season, value: s.plantHeight })),
      leafAreaIndex: series.map((s) => ({ season: s.season, value: s.leafAreaIndex })),
      erosionScore: series.map((s) => ({ season: s.season, value: s.erosionScore }))
    };

    const indicators = TRACKED_INDICATORS.map((indicator) => {
      const trend = computeTrend(indicator, indicatorSeries[indicator] || []);
      return {
        indicator: trend.indicator,
        classification: trend.classification,
        timeSeries: trend.timeSeries,
        trendMagnitude: trend.trendMagnitude,
        explanation: explainTrend(trend)
      };
    });

    res.json({ indicators });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  computeSeason,
  computeSeasonCore,
  computeScenariosRoute,
  computeTrendsRoute,
  buildSeasonSeries
};
