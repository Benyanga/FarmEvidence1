const Trial = require('../models/Trial');
const Treatment = require('../models/Treatment');
const TrialPlot = require('../models/TrialPlot');
const TrialInputCost = require('../models/TrialInputCost');
const TrialLaborCost = require('../models/TrialLaborCost');
const TrialYield = require('../models/TrialYield');
const Season = require('../models/Season');
const Setup = require('../models/Setup');

/** Ensures a TrialPlot exists for every (treatment, replicate) cell — additive only, never deletes. */
async function ensurePlotGrid(trial, treatments) {
  const existing = await TrialPlot.find({ trialId: trial._id });
  const existingKey = (treatmentId, rep) => `${treatmentId}:${rep}`;
  const existingSet = new Set(existing.map((p) => existingKey(String(p.treatmentId), p.replicateNumber)));

  const toCreate = [];
  for (const treatment of treatments) {
    for (let rep = 1; rep <= trial.numReplicates; rep += 1) {
      if (!existingSet.has(existingKey(String(treatment._id), rep))) {
        toCreate.push({
          trialId: trial._id,
          treatmentId: treatment._id,
          replicateNumber: rep,
          plotSizeM2: trial.plotSizeM2
        });
      }
    }
  }
  if (toCreate.length > 0) {
    const docs = toCreate.map((d) => new TrialPlot(d));
    await Promise.all(docs.map((d) => d.save()));
    return docs;
  }
  return [];
}

async function cascadeDeleteTrial(trialId) {
  const treatments = await Treatment.find({ trialId }).select('_id');
  const plots = await TrialPlot.find({ trialId }).select('_id');
  const plotIds = plots.map((p) => p._id);

  await Promise.all([
    TrialInputCost.deleteMany({ trialPlotId: { $in: plotIds } }),
    TrialLaborCost.deleteMany({ trialPlotId: { $in: plotIds } }),
    TrialYield.deleteMany({ trialPlotId: { $in: plotIds } })
  ]);
  await TrialPlot.deleteMany({ trialId });
  await Treatment.deleteMany({ trialId });
  return { treatmentCount: treatments.length, plotCount: plotIds.length };
}

/**
 * Max existing trialNumber + 1 — NOT countDocuments()+1, which collides with
 * {setupId,trialNumber}'s unique index whenever a setup's trial history has
 * drifted from a dense 1..N sequence (e.g. an earlier trial was deleted).
 */
async function nextTrialNumber(setupId) {
  const last = await Trial.findOne({ setupId }).sort({ trialNumber: -1 }).select('trialNumber');
  return (last?.trialNumber || 0) + 1;
}

/** Every trial is a CA vs CF comparison — exactly those two codes, no more, no fewer. */
function isCACFPair(treatments) {
  const codes = new Set(treatments.map((t) => t.code));
  return codes.size === 2 && codes.has('CA') && codes.has('CF');
}

async function listTrials(req, res, next) {
  try {
    const trials = await Trial.find({ seasonId: req.params.seasonId }).sort({ trialNumber: 1 });
    res.json({ trials });
  } catch (err) {
    next(err);
  }
}

/** GET /trials — every trial owned by the researcher, across all their setups. */
async function listAllTrials(req, res, next) {
  try {
    const trials = await Trial.find({ ownerId: req.dbUser._id }).sort({ createdAt: -1 });
    const setupIds = [...new Set(trials.map((t) => String(t.setupId)))];
    const seasonIds = [...new Set(trials.map((t) => String(t.seasonId)))];
    const trialIds = trials.map((t) => t._id);
    const [setups, seasons, treatments] = await Promise.all([
      Setup.find({ _id: { $in: setupIds } }).select('name location'),
      Season.find({ _id: { $in: seasonIds } }).select('year seasonCode seasonLabel'),
      Treatment.find({ trialId: { $in: trialIds } }).select('trialId code')
    ]);
    const setupById = new Map(setups.map((s) => [String(s._id), s]));
    const seasonById = new Map(seasons.map((s) => [String(s._id), s]));
    const codesByTrial = new Map();
    for (const tr of treatments) {
      const key = String(tr.trialId);
      if (!codesByTrial.has(key)) codesByTrial.set(key, []);
      codesByTrial.get(key).push(tr.code);
    }

    const enriched = trials.map((t) => {
      const codes = codesByTrial.get(String(t._id)) || [];
      return {
        trial: t,
        setup: setupById.get(String(t.setupId)) || null,
        season: seasonById.get(String(t.seasonId)) || null,
        // Whether this trial is a strict CA-vs-CF comparison — legacy trials
        // (free-text codes seeded before this constraint existed) are not,
        // and the new dashboard hides them rather than misrepresenting them.
        isCACF: isCACFPair(codes.map((code) => ({ code })))
      };
    });

    res.json({ trials: enriched });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /seasons/:seasonId/trials — creates the trial, its Treatment Register,
 * and auto-generates the full t x b TrialPlot grid.
 * Body: { ...trial config fields, treatments: [{code,label,description}] }
 */
async function createTrial(req, res, next) {
  try {
    const season = await Season.findById(req.params.seasonId);
    if (!season) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Season not found.' } });
    }
    const setup = req.setup || (await Setup.findById(season.setupId));

    const { treatments: treatmentInputs, ...trialBody } = req.body;
    if (!Array.isArray(treatmentInputs) || treatmentInputs.length !== 2 || !isCACFPair(treatmentInputs)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Every trial compares exactly two treatments, coded CA and CF.',
          field: 'treatments'
        }
      });
    }

    const trialNumber = await nextTrialNumber(setup._id);
    const trial = await Trial.create({
      ...trialBody,
      numTreatments: 2,
      seasonId: season._id,
      setupId: setup._id,
      ownerId: req.dbUser._id,
      trialNumber
    });

    const treatments = await Treatment.insertMany(
      treatmentInputs.map((t) => ({ ...t, trialId: trial._id }))
    );

    const plots = await ensurePlotGrid(trial, treatments);

    res.status(201).json({ trial, treatments, plots });
  } catch (err) {
    next(err);
  }
}

async function getTrial(req, res, next) {
  try {
    const trial = await Trial.findById(req.params.id);
    if (!trial) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Trial not found.' } });
    }
    const [treatments, plots, season, setup] = await Promise.all([
      Treatment.find({ trialId: trial._id }).sort({ code: 1 }),
      TrialPlot.find({ trialId: trial._id }).sort({ treatmentId: 1, replicateNumber: 1 }),
      Season.findById(trial.seasonId),
      Setup.findById(trial.setupId)
    ]);
    res.json({ trial, treatments, plots, season, setup });
  } catch (err) {
    next(err);
  }
}

/** PUT /trials/:id — config edits. numTreatments is derived from the Treatment Register and cannot be set directly here. */
async function updateTrial(req, res, next) {
  try {
    const { numTreatments, ...updates } = req.body;
    const trial = await Trial.findById(req.params.id);
    if (!trial) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Trial not found.' } });
    }
    Object.assign(trial, updates);
    await trial.save();

    let plots = [];
    if (typeof updates.numReplicates === 'number') {
      const treatments = await Treatment.find({ trialId: trial._id });
      plots = await ensurePlotGrid(trial, treatments);
    }

    res.json({ trial, newPlots: plots });
  } catch (err) {
    next(err);
  }
}

async function deleteTrial(req, res, next) {
  try {
    const trial = await Trial.findByIdAndDelete(req.params.id);
    if (!trial) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Trial not found.' } });
    }
    await cascadeDeleteTrial(trial._id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// ---------- Treatment Register ----------

async function listTreatments(req, res, next) {
  try {
    const treatments = await Treatment.find({ trialId: req.params.trialId }).sort({ code: 1 });
    res.json({ treatments });
  } catch (err) {
    next(err);
  }
}

/** POST /trials/:trialId/treatments — adds a treatment and its b replicate plots, bumps Trial.numTreatments. */
async function createTreatment(req, res, next) {
  try {
    const trial = await Trial.findById(req.params.trialId);
    if (!trial) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Trial not found.' } });
    }
    const existing = await Treatment.find({ trialId: trial._id }).select('code');
    if (isCACFPair(existing)) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'This trial already has both CA and CF treatments — a trial always compares exactly two.' }
      });
    }
    const treatment = await Treatment.create({ ...req.body, trialId: trial._id });

    trial.numTreatments += 1;
    await trial.save();

    const plots = await ensurePlotGrid(trial, [treatment]);
    res.status(201).json({ treatment, trial, plots });
  } catch (err) {
    next(err);
  }
}

async function updateTreatment(req, res, next) {
  try {
    const treatment = await Treatment.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
    if (!treatment) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Treatment not found.' } });
    }
    res.json({ treatment });
  } catch (err) {
    next(err);
  }
}

/** DELETE /treatments/:id — removes the treatment, its plots, and cascades cost/labour/yield rows; decrements Trial.numTreatments. */
async function deleteTreatment(req, res, next) {
  try {
    const treatment = await Treatment.findById(req.params.id);
    if (!treatment) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Treatment not found.' } });
    }
    const siblings = await Treatment.find({ trialId: treatment.trialId }).select('code');
    if (isCACFPair(siblings)) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Cannot remove a treatment from a CA/CF trial — a trial always compares exactly two.' }
      });
    }
    await treatment.deleteOne();
    const plots = await TrialPlot.find({ treatmentId: treatment._id }).select('_id');
    const plotIds = plots.map((p) => p._id);
    await Promise.all([
      TrialInputCost.deleteMany({ trialPlotId: { $in: plotIds } }),
      TrialLaborCost.deleteMany({ trialPlotId: { $in: plotIds } }),
      TrialYield.deleteMany({ trialPlotId: { $in: plotIds } })
    ]);
    await TrialPlot.deleteMany({ treatmentId: treatment._id });

    const trial = await Trial.findById(treatment.trialId);
    if (trial) {
      trial.numTreatments = Math.max(1, trial.numTreatments - 1);
      await trial.save();
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listTrials,
  listAllTrials,
  createTrial,
  getTrial,
  updateTrial,
  deleteTrial,
  listTreatments,
  createTreatment,
  updateTreatment,
  deleteTreatment
};
