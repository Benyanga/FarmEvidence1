const Season = require('../models/Season');
const Setup = require('../models/Setup');
const Plot = require('../models/Plot');
const { computeCropPopulation } = require('../engines/agronomy.engine');

function withCropPopulation(body) {
  if (body.rowSpacing && typeof body.seedsPerHill === 'number') {
    return {
      ...body,
      cropPopulation: computeCropPopulation({
        intraRow: body.rowSpacing.intraRow,
        interRow: body.rowSpacing.interRow,
        seedsPerHill: body.seedsPerHill
      })
    };
  }
  return body;
}

async function nextSeasonNumber(setupId) {
  const count = await Season.countDocuments({ setupId });
  return count + 1;
}

async function listSeasons(req, res, next) {
  try {
    const seasons = await Season.find({ setupId: req.params.setupId }).sort({ seasonNumber: 1 });
    res.json({ seasons });
  } catch (err) {
    next(err);
  }
}

/** GET /seasons — every season across every farm the current user owns, enriched with its farm. */
async function listAllSeasons(req, res, next) {
  try {
    const setups = await Setup.find({ ownerId: req.dbUser._id, active: true }).select('name location setupType');
    const setupIds = setups.map((s) => s._id);
    const seasons = await Season.find({ setupId: { $in: setupIds } }).sort({ createdAt: -1 });
    const setupById = new Map(setups.map((s) => [String(s._id), s]));

    const enriched = seasons.map((season) => ({
      season,
      setup: setupById.get(String(season.setupId)) || null
    }));

    res.json({ seasons: enriched });
  } catch (err) {
    next(err);
  }
}

async function createSeason(req, res, next) {
  try {
    const setup = await Setup.findOne({ _id: req.params.setupId, ownerId: req.dbUser._id });
    if (!setup) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Setup not found.' } });
    }

    // Farmer Mode: a season IS the CA/CF comparison unit, so these are required.
    // Research Mode: seasons are just a year/seasonCode time bucket — the
    // farmingSystem comparison lives on each Trial's plots instead (see
    // trial.controller.js), so these fields are never sent for research.
    if (setup.setupType !== 'research_trial') {
      if (!req.body.farmingSystem || !req.body.cropType) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'farmingSystem and cropType are required.', field: 'farmingSystem' }
        });
      }
    }

    const season = await Season.create({
      ...withCropPopulation(req.body),
      setupId: setup._id,
      ownerId: req.dbUser._id
    });

    // Farmer Mode has no visible "plot" concept — a season maps to exactly
    // one implicit plot representing the farm, auto-created here so Data
    // Entry can go straight from Season -> the four data-entry tables.
    if (setup.setupType !== 'research_trial') {
      await Plot.create({
        seasonId: season._id,
        setupId: setup._id,
        ownerId: req.dbUser._id,
        replicationNumber: 1,
        plotArea: setup.area ? Math.round((setup.area / 10000) * 100) / 100 : 0.5
      });
    }

    res.status(201).json({ season });
  } catch (err) {
    next(err);
  }
}

/**
 * Research Mode — lazily creates the Season for a given (year, seasonCode)
 * time bucket the first time a researcher clicks that Season A/B/C button,
 * so there is no separate "create season" form to fill in.
 * POST /setups/:setupId/seasons/get-or-create  body: { year, seasonCode }
 */
async function getOrCreateSeason(req, res, next) {
  try {
    const setup = await Setup.findOne({ _id: req.params.setupId, ownerId: req.dbUser._id });
    if (!setup) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Setup not found.' } });
    }
    const { year, seasonCode } = req.body;
    if (!year || !seasonCode) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'year and seasonCode are required.' } });
    }

    let season = await Season.findOne({ setupId: setup._id, year, seasonCode });
    if (!season) {
      season = await Season.create({
        setupId: setup._id,
        ownerId: req.dbUser._id,
        year,
        seasonCode,
        seasonLabel: `Season ${seasonCode} ${year}`,
        seasonNumber: await nextSeasonNumber(setup._id)
      });
    }

    res.json({ season });
  } catch (err) {
    next(err);
  }
}

async function getSeason(req, res, next) {
  try {
    const season = await Season.findById(req.params.id);
    if (!season) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Season not found.' } });
    }
    let plots = await Plot.find({ seasonId: season._id });

    // Back-fill the implicit farm plot for seasons created before auto-creation existed.
    if (plots.length === 0) {
      const setup = await Setup.findById(season.setupId);
      if (setup && setup.setupType !== 'research_trial') {
        const plot = await Plot.create({
          seasonId: season._id,
          setupId: season.setupId,
          ownerId: season.ownerId,
          replicationNumber: 1,
          plotArea: setup.area ? Math.round((setup.area / 10000) * 100) / 100 : 0.5
        });
        plots = [plot];
      }
    }

    res.json({ season, plots });
  } catch (err) {
    next(err);
  }
}

async function updateSeason(req, res, next) {
  try {
    const season = await Season.findByIdAndUpdate(req.params.id, { $set: withCropPopulation(req.body) }, { new: true, runValidators: true });
    if (!season) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Season not found.' } });
    }
    res.json({ season });
  } catch (err) {
    next(err);
  }
}

async function deleteSeason(req, res, next) {
  try {
    const season = await Season.findByIdAndDelete(req.params.id);
    if (!season) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Season not found.' } });
    }

    // Farmer Mode: cascade this season's implicit Plot + its cost/labor/agronomic/yield ledger rows.
    const plots = await Plot.find({ seasonId: season._id }).select('_id');
    const plotIds = plots.map((p) => p._id);
    await Plot.deleteMany({ _id: { $in: plotIds } });

    const CostRecord = require('../models/CostRecord');
    const LaborRecord = require('../models/LaborRecord');
    const AgronomicRecord = require('../models/AgronomicRecord');
    const YieldRecord = require('../models/YieldRecord');
    await Promise.all([
      CostRecord.deleteMany({ plotId: { $in: plotIds } }),
      LaborRecord.deleteMany({ plotId: { $in: plotIds } }),
      AgronomicRecord.deleteMany({ plotId: { $in: plotIds } }),
      YieldRecord.deleteMany({ plotId: { $in: plotIds } })
    ]);

    // Research Mode: cascade every Trial nested in this season.
    const Trial = require('../models/Trial');
    const Treatment = require('../models/Treatment');
    const TrialPlot = require('../models/TrialPlot');
    const TrialInputCost = require('../models/TrialInputCost');
    const TrialLaborCost = require('../models/TrialLaborCost');
    const TrialYield = require('../models/TrialYield');

    const trials = await Trial.find({ seasonId: season._id }).select('_id');
    const trialIds = trials.map((t) => t._id);
    const trialPlots = await TrialPlot.find({ trialId: { $in: trialIds } }).select('_id');
    const trialPlotIds = trialPlots.map((p) => p._id);

    await Promise.all([
      TrialInputCost.deleteMany({ trialPlotId: { $in: trialPlotIds } }),
      TrialLaborCost.deleteMany({ trialPlotId: { $in: trialPlotIds } }),
      TrialYield.deleteMany({ trialPlotId: { $in: trialPlotIds } })
    ]);
    await TrialPlot.deleteMany({ trialId: { $in: trialIds } });
    await Treatment.deleteMany({ trialId: { $in: trialIds } });
    await Trial.deleteMany({ seasonId: season._id });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { listSeasons, listAllSeasons, createSeason, getOrCreateSeason, getSeason, updateSeason, deleteSeason };
