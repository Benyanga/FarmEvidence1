const Plot = require('../models/Plot');
const Season = require('../models/Season');
const CostRecord = require('../models/CostRecord');
const LaborRecord = require('../models/LaborRecord');
const AgronomicRecord = require('../models/AgronomicRecord');
const YieldRecord = require('../models/YieldRecord');
const Setup = require('../models/Setup');
const { plotCostBreakdown, plotYieldSummary } = require('../services/plotFinancials.service');

async function listPlots(req, res, next) {
  try {
    const plots = await Plot.find({ seasonId: req.params.seasonId });
    res.json({ plots });
  } catch (err) {
    next(err);
  }
}

async function createPlot(req, res, next) {
  try {
    const season = await Season.findById(req.params.seasonId);
    if (!season) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Season not found.' } });
    }
    const plot = await Plot.create({
      ...req.body,
      seasonId: season._id,
      setupId: season.setupId,
      ownerId: req.dbUser._id
    });
    res.status(201).json({ plot });
  } catch (err) {
    next(err);
  }
}

async function getPlot(req, res, next) {
  try {
    const plot = await Plot.findById(req.params.id);
    if (!plot) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Plot not found.' } });
    }
    const setup = await Setup.findById(plot.setupId);
    const isFarmer = setup?.setupType !== 'research_trial';

    const [season, costs, labor, agronomic, costSummary, yieldSummary] = await Promise.all([
      Season.findById(plot.seasonId),
      CostRecord.find({ plotId: plot._id }).sort({ date: 1 }),
      LaborRecord.find({ plotId: plot._id }).sort({ date: 1 }),
      AgronomicRecord.findOne({ plotId: plot._id }),
      plotCostBreakdown(plot._id),
      isFarmer ? plotYieldSummary(plot._id) : Promise.resolve(null)
    ]);

    res.json({
      plot,
      season,
      costs,
      labor,
      agronomic,
      costSummary,
      yields: yieldSummary?.rows || [],
      yieldSummary: yieldSummary
        ? {
            totalHarvested: yieldSummary.totalHarvested,
            totalSold: yieldSummary.totalSold,
            totalRevenue: yieldSummary.totalRevenue,
            remainingYield: yieldSummary.remainingYield,
            lastPrice: yieldSummary.lastPrice
          }
        : null
    });
  } catch (err) {
    next(err);
  }
}

async function updatePlot(req, res, next) {
  try {
    const plot = await Plot.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
    if (!plot) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Plot not found.' } });
    }
    res.json({ plot });
  } catch (err) {
    next(err);
  }
}

async function deletePlot(req, res, next) {
  try {
    const plot = await Plot.findByIdAndDelete(req.params.id);
    if (!plot) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Plot not found.' } });
    }
    await Promise.all([
      CostRecord.deleteMany({ plotId: plot._id }),
      LaborRecord.deleteMany({ plotId: plot._id }),
      AgronomicRecord.deleteMany({ plotId: plot._id }),
      YieldRecord.deleteMany({ plotId: plot._id })
    ]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { listPlots, createPlot, getPlot, updatePlot, deletePlot };
