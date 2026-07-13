const CostRecord = require('../models/CostRecord');
const LaborRecord = require('../models/LaborRecord');
const Plot = require('../models/Plot');
const Season = require('../models/Season');
const { computeLaborRowCost } = require('../engines/laborcost.engine');

// ---------- Input Costs ----------

async function listCosts(req, res, next) {
  try {
    const costs = await CostRecord.find({ plotId: req.params.plotId }).sort({ date: 1 });
    res.json({ costs });
  } catch (err) {
    next(err);
  }
}

async function createCost(req, res, next) {
  try {
    const plot = await Plot.findById(req.params.plotId);
    if (!plot) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Plot not found.' } });
    }

    const cost = await CostRecord.create({
      ...req.body,
      plotId: plot._id,
      seasonId: plot.seasonId,
      setupId: plot.setupId,
      ownerId: req.dbUser._id
    });
    res.status(201).json({ cost });
  } catch (err) {
    next(err);
  }
}

async function updateCost(req, res, next) {
  try {
    const cost = await CostRecord.findById(req.params.id);
    if (!cost) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Cost record not found.' } });
    }
    Object.assign(cost, req.body);
    await cost.save();
    res.json({ cost });
  } catch (err) {
    next(err);
  }
}

async function deleteCost(req, res, next) {
  try {
    const cost = await CostRecord.findByIdAndDelete(req.params.id);
    if (!cost) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Cost record not found.' } });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// ---------- Labour Costs ----------

async function listLabor(req, res, next) {
  try {
    const labor = await LaborRecord.find({ plotId: req.params.plotId }).sort({ date: 1 });
    res.json({ labor });
  } catch (err) {
    next(err);
  }
}

async function createLabor(req, res, next) {
  try {
    const plot = await Plot.findById(req.params.plotId);
    if (!plot) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Plot not found.' } });
    }
    const season = await Season.findById(plot.seasonId);

    const wageRatePerDay =
      typeof req.body.wageRatePerDay === 'number' ? req.body.wageRatePerDay : season?.laborSettings?.wageRatePerDay;
    const workingHoursPerDay =
      typeof req.body.workingHoursPerDay === 'number'
        ? req.body.workingHoursPerDay
        : season?.laborSettings?.workingHoursPerDay || 8;

    if (typeof wageRatePerDay !== 'number') {
      return res.status(422).json({
        error: {
          code: 'MISSING_WAGE_RATE',
          message: 'Set the season wage rate (RWF/day) before recording labour rows.',
          field: 'wageRatePerDay'
        }
      });
    }

    const laborCost = computeLaborRowCost({
      timeTaken: req.body.timeTaken,
      unit: req.body.unit,
      wageRatePerDay,
      workingHoursPerDay
    });

    const labor = await LaborRecord.create({
      ...req.body,
      wageRatePerDay,
      workingHoursPerDay,
      laborCost,
      plotId: plot._id,
      seasonId: plot.seasonId,
      setupId: plot.setupId,
      ownerId: req.dbUser._id
    });

    res.status(201).json({ labor });
  } catch (err) {
    next(err);
  }
}

async function updateLabor(req, res, next) {
  try {
    const labor = await LaborRecord.findById(req.params.id);
    if (!labor) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Labor record not found.' } });
    }
    Object.assign(labor, req.body);
    labor.laborCost = computeLaborRowCost({
      timeTaken: labor.timeTaken,
      unit: labor.unit,
      wageRatePerDay: labor.wageRatePerDay,
      workingHoursPerDay: labor.workingHoursPerDay
    });
    await labor.save();
    res.json({ labor });
  } catch (err) {
    next(err);
  }
}

async function deleteLabor(req, res, next) {
  try {
    const labor = await LaborRecord.findByIdAndDelete(req.params.id);
    if (!labor) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Labor record not found.' } });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listCosts,
  createCost,
  updateCost,
  deleteCost,
  listLabor,
  createLabor,
  updateLabor,
  deleteLabor
};
