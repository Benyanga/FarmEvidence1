const TrialPlot = require('../models/TrialPlot');
const Trial = require('../models/Trial');
const Treatment = require('../models/Treatment');
const TrialInputCost = require('../models/TrialInputCost');
const TrialLaborCost = require('../models/TrialLaborCost');
const TrialYield = require('../models/TrialYield');
const { trialPlotCostBreakdown } = require('../services/trialPlotFinancials.service');
const { computePlotRollup } = require('../engines/researchAnalysis.engine');

// ---------- Trial Plot ----------

async function getTrialPlot(req, res, next) {
  try {
    const plot = await TrialPlot.findById(req.params.id);
    if (!plot) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Trial plot not found.' } });
    }
    const [treatment, costBreakdown, yieldEntry] = await Promise.all([
      Treatment.findById(plot.treatmentId),
      trialPlotCostBreakdown(plot._id),
      TrialYield.findOne({ trialPlotId: plot._id })
    ]);

    const rollup = computePlotRollup({
      costBreakdown,
      grossRevenueRwf: yieldEntry?.grossRevenueRwf,
      yieldKg: yieldEntry?.yieldKg,
      plotSizeM2: plot.plotSizeM2
    });

    res.json({ plot, treatment, costBreakdown, yield: yieldEntry, rollup });
  } catch (err) {
    next(err);
  }
}

/** PUT /trial-plots/:id — override plot size. */
async function updateTrialPlot(req, res, next) {
  try {
    const plot = await TrialPlot.findById(req.params.id);
    if (!plot) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Trial plot not found.' } });
    }
    if (typeof req.body.plotSizeM2 === 'number') plot.plotSizeM2 = req.body.plotSizeM2;
    await plot.save();
    res.json({ plot });
  } catch (err) {
    next(err);
  }
}

// ---------- Input Costs ----------

async function listInputCosts(req, res, next) {
  try {
    const costs = await TrialInputCost.find({ trialPlotId: req.params.trialPlotId }).sort({ date: 1 });
    res.json({ costs });
  } catch (err) {
    next(err);
  }
}

async function createInputCost(req, res, next) {
  try {
    const plot = await TrialPlot.findById(req.params.trialPlotId);
    if (!plot) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Trial plot not found.' } });
    }
    const cost = await TrialInputCost.create({ ...req.body, trialPlotId: plot._id, ownerId: req.dbUser._id });
    res.status(201).json({ cost });
  } catch (err) {
    next(err);
  }
}

async function updateInputCost(req, res, next) {
  try {
    const cost = await TrialInputCost.findById(req.params.id);
    if (!cost) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Input cost not found.' } });
    }
    Object.assign(cost, req.body);
    await cost.save();
    res.json({ cost });
  } catch (err) {
    next(err);
  }
}

async function deleteInputCost(req, res, next) {
  try {
    const cost = await TrialInputCost.findByIdAndDelete(req.params.id);
    if (!cost) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Input cost not found.' } });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// ---------- Labour Costs ----------

async function listLabourCosts(req, res, next) {
  try {
    const labour = await TrialLaborCost.find({ trialPlotId: req.params.trialPlotId }).sort({ date: 1 });
    res.json({ labour });
  } catch (err) {
    next(err);
  }
}

async function createLabourCost(req, res, next) {
  try {
    const plot = await TrialPlot.findById(req.params.trialPlotId);
    if (!plot) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Trial plot not found.' } });
    }
    const trial = await Trial.findById(plot.trialId);

    const wageRatePerDayRwf =
      typeof req.body.wageRatePerDayRwf === 'number' ? req.body.wageRatePerDayRwf : trial?.wageRatePerDayRwf;
    const workingHoursPerDay =
      typeof req.body.workingHoursPerDay === 'number' ? req.body.workingHoursPerDay : trial?.workingHoursPerDay || 8;

    if (typeof wageRatePerDayRwf !== 'number') {
      return res.status(422).json({
        error: {
          code: 'MISSING_WAGE_RATE',
          message: 'Set the trial wage rate (RWF/day) before recording labour rows.',
          field: 'wageRatePerDayRwf'
        }
      });
    }

    const labour = await TrialLaborCost.create({
      ...req.body,
      wageRatePerDayRwf,
      workingHoursPerDay,
      trialPlotId: plot._id,
      ownerId: req.dbUser._id
    });

    res.status(201).json({ labour });
  } catch (err) {
    next(err);
  }
}

async function updateLabourCost(req, res, next) {
  try {
    const labour = await TrialLaborCost.findById(req.params.id);
    if (!labour) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Labour cost not found.' } });
    }
    Object.assign(labour, req.body);
    await labour.save();
    res.json({ labour });
  } catch (err) {
    next(err);
  }
}

async function deleteLabourCost(req, res, next) {
  try {
    const labour = await TrialLaborCost.findByIdAndDelete(req.params.id);
    if (!labour) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Labour cost not found.' } });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// ---------- Yield & Revenue (one per plot) ----------

async function getYield(req, res, next) {
  try {
    const yieldEntry = await TrialYield.findOne({ trialPlotId: req.params.trialPlotId });
    res.json({ yield: yieldEntry });
  } catch (err) {
    next(err);
  }
}

/** PUT /trial-plots/:trialPlotId/yield — upsert (one entry per plot, unlocked at harvest). */
async function upsertYield(req, res, next) {
  try {
    const plot = await TrialPlot.findById(req.params.trialPlotId);
    if (!plot) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Trial plot not found.' } });
    }
    const trial = await Trial.findById(plot.trialId);

    const priceRwfPerKg =
      typeof req.body.priceRwfPerKg === 'number' ? req.body.priceRwfPerKg : trial?.marketPriceRwfPerKg;
    if (typeof priceRwfPerKg !== 'number') {
      return res.status(422).json({
        error: {
          code: 'MISSING_PRICE',
          message: 'Set the trial market price (RWF/kg) before recording yield.',
          field: 'priceRwfPerKg'
        }
      });
    }

    let yieldEntry = await TrialYield.findOne({ trialPlotId: plot._id });
    if (yieldEntry) {
      yieldEntry.yieldKg = req.body.yieldKg;
      yieldEntry.priceRwfPerKg = priceRwfPerKg;
      await yieldEntry.save();
    } else {
      yieldEntry = await TrialYield.create({
        trialPlotId: plot._id,
        ownerId: req.dbUser._id,
        yieldKg: req.body.yieldKg,
        priceRwfPerKg
      });
    }

    res.json({ yield: yieldEntry });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getTrialPlot,
  updateTrialPlot,
  listInputCosts,
  createInputCost,
  updateInputCost,
  deleteInputCost,
  listLabourCosts,
  createLabourCost,
  updateLabourCost,
  deleteLabourCost,
  getYield,
  upsertYield
};
