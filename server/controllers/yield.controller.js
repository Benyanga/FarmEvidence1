const YieldRecord = require('../models/YieldRecord');
const Plot = require('../models/Plot');
const { recomputeYieldLedger } = require('../engines/yieldLedger.engine');

/** Re-derives remainingYield/totalRevenue for every row of a plot's ledger, in date order. */
async function recomputePlotLedger(plotId) {
  const rows = await YieldRecord.find({ plotId }).sort({ date: 1, createdAt: 1 });
  const recomputed = recomputeYieldLedger(rows.map((r) => ({
    yieldHarvested: r.yieldHarvested,
    yieldSold: r.yieldSold,
    marketPrice: r.marketPrice
  })));
  await Promise.all(
    rows.map((row, i) => {
      row.remainingYield = recomputed[i].remainingYield;
      row.totalRevenue = recomputed[i].totalRevenue;
      return row.save();
    })
  );
  return rows;
}

async function listYields(req, res, next) {
  try {
    const records = await YieldRecord.find({ plotId: req.params.plotId }).sort({ date: 1, createdAt: 1 });
    res.json({ yields: records });
  } catch (err) {
    next(err);
  }
}

async function createYield(req, res, next) {
  try {
    const plot = await Plot.findById(req.params.plotId);
    if (!plot) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Plot not found.' } });
    }

    await YieldRecord.create({
      ...req.body,
      remainingYield: 0,
      totalRevenue: 0,
      plotId: plot._id,
      seasonId: plot.seasonId,
      setupId: plot.setupId,
      ownerId: req.dbUser._id
    });

    const rows = await recomputePlotLedger(plot._id);
    res.status(201).json({ yields: rows });
  } catch (err) {
    next(err);
  }
}

async function updateYield(req, res, next) {
  try {
    const record = await YieldRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Yield record not found.' } });
    }
    Object.assign(record, req.body);
    await record.save();
    const rows = await recomputePlotLedger(record.plotId);
    res.json({ yields: rows });
  } catch (err) {
    next(err);
  }
}

async function deleteYield(req, res, next) {
  try {
    const record = await YieldRecord.findByIdAndDelete(req.params.id);
    if (!record) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Yield record not found.' } });
    }
    const rows = await recomputePlotLedger(record.plotId);
    res.json({ success: true, yields: rows });
  } catch (err) {
    next(err);
  }
}

module.exports = { listYields, createYield, updateYield, deleteYield, recomputePlotLedger };
