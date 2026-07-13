const Setup = require('../models/Setup');
const Season = require('../models/Season');
const { computeFarmArea } = require('../engines/agronomy.engine');

const SETUP_TYPE_BY_ROLE = { farmer: 'farm', researcher: 'research_trial' };

async function listSetups(req, res, next) {
  try {
    const setups = await Setup.find({ ownerId: req.dbUser._id, active: true }).sort({ createdAt: -1 });
    res.json({ setups });
  } catch (err) {
    next(err);
  }
}

async function createSetup(req, res, next) {
  try {
    const { setupType, ...body } = req.body; // setupType is never user-supplied — derived from role
    const area = body.farmDimensions ? computeFarmArea(body.farmDimensions) : undefined;

    const setup = await Setup.create({
      ...body,
      area,
      setupType: SETUP_TYPE_BY_ROLE[req.dbUser.role],
      ownerId: req.dbUser._id
    });
    res.status(201).json({ setup });
  } catch (err) {
    next(err);
  }
}

async function getSetup(req, res, next) {
  try {
    const setup = await Setup.findOne({ _id: req.params.id, ownerId: req.dbUser._id });
    if (!setup) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Setup not found.' } });
    }
    const seasons = await Season.find({ setupId: setup._id }).sort({ seasonNumber: 1 });
    res.json({ setup, seasons });
  } catch (err) {
    next(err);
  }
}

async function updateSetup(req, res, next) {
  try {
    // setupType is derived from role and never user-editable.
    const { rcbd, setupType, ...rest } = req.body;
    const existingSeasons = await Season.countDocuments({ setupId: req.params.id });

    const update = { ...rest };
    if (update.farmDimensions) {
      update.area = computeFarmArea(update.farmDimensions);
    }
    if (!existingSeasons && rcbd) {
      update.rcbd = rcbd;
    }

    const setup = await Setup.findOneAndUpdate(
      { _id: req.params.id, ownerId: req.dbUser._id },
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!setup) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Setup not found.' } });
    }
    res.json({ setup });
  } catch (err) {
    next(err);
  }
}

/** Research Mode — appends a year to the setup's list of opened research years. */
async function addResearchYear(req, res, next) {
  try {
    const { year } = req.body;
    if (!year) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'year is required.' } });
    }
    const setup = await Setup.findOne({ _id: req.params.id, ownerId: req.dbUser._id });
    if (!setup) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Setup not found.' } });
    }
    if (!setup.researchYears.includes(year)) {
      setup.researchYears.push(year);
      setup.researchYears.sort((a, b) => a - b);
      await setup.save();
    }
    res.json({ setup });
  } catch (err) {
    next(err);
  }
}

async function deleteSetup(req, res, next) {
  try {
    const setup = await Setup.findOneAndUpdate(
      { _id: req.params.id, ownerId: req.dbUser._id },
      { $set: { active: false } },
      { new: true }
    );
    if (!setup) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Setup not found.' } });
    }
    res.json({ setup });
  } catch (err) {
    next(err);
  }
}

module.exports = { listSetups, createSetup, getSetup, updateSetup, deleteSetup, addResearchYear };
