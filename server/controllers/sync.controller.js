const { v4: uuidv4 } = require('uuid');
const SyncLog = require('../models/SyncLog');
const Setup = require('../models/Setup');
const Season = require('../models/Season');
const Plot = require('../models/Plot');
const CostRecord = require('../models/CostRecord');
const LaborRecord = require('../models/LaborRecord');
const AgronomicRecord = require('../models/AgronomicRecord');
const YieldRecord = require('../models/YieldRecord');
const { computeLaborRowCost } = require('../engines/laborcost.engine');
const { recomputePlotLedger } = require('./yield.controller');

const CREATE_ROUTES = [
  {
    method: 'POST',
    pattern: /^\/setups$/,
    handler: async (m, body, ctx) => Setup.create({ ...body, ownerId: ctx.ownerId })
  },
  {
    method: 'POST',
    pattern: /^\/setups\/([^/]+)\/seasons$/,
    handler: async (m, body, ctx) => Season.create({ ...body, setupId: m[1], ownerId: ctx.ownerId })
  },
  {
    method: 'POST',
    pattern: /^\/seasons\/([^/]+)\/plots$/,
    handler: async (m, body, ctx) => {
      const season = await Season.findById(m[1]);
      if (!season) throw Object.assign(new Error('Season not found'), { status: 404 });
      return Plot.create({ ...body, seasonId: season._id, setupId: season.setupId, ownerId: ctx.ownerId });
    }
  },
  {
    method: 'POST',
    pattern: /^\/plots\/([^/]+)\/costs$/,
    handler: async (m, body, ctx) => {
      const plot = await Plot.findById(m[1]);
      if (!plot) throw Object.assign(new Error('Plot not found'), { status: 404 });
      return CostRecord.create({ ...body, plotId: plot._id, seasonId: plot.seasonId, setupId: plot.setupId, ownerId: ctx.ownerId });
    }
  },
  {
    method: 'POST',
    pattern: /^\/plots\/([^/]+)\/labor$/,
    handler: async (m, body, ctx) => {
      const plot = await Plot.findById(m[1]);
      if (!plot) throw Object.assign(new Error('Plot not found'), { status: 404 });
      const season = await Season.findById(plot.seasonId);
      const wageRatePerDay = typeof body.wageRatePerDay === 'number' ? body.wageRatePerDay : season?.laborSettings?.wageRatePerDay;
      const workingHoursPerDay =
        typeof body.workingHoursPerDay === 'number' ? body.workingHoursPerDay : season?.laborSettings?.workingHoursPerDay || 8;
      if (typeof wageRatePerDay !== 'number') {
        throw Object.assign(new Error('Set the season wage rate (RWF/day) before recording labour rows.'), { status: 422 });
      }
      const laborCost = computeLaborRowCost({ timeTaken: body.timeTaken, unit: body.unit, wageRatePerDay, workingHoursPerDay });
      return LaborRecord.create({
        ...body,
        wageRatePerDay,
        workingHoursPerDay,
        laborCost,
        plotId: plot._id,
        seasonId: plot.seasonId,
        setupId: plot.setupId,
        ownerId: ctx.ownerId
      });
    }
  },
  {
    method: 'POST',
    pattern: /^\/plots\/([^/]+)\/agronomic$/,
    handler: async (m, body, ctx) => {
      const plot = await Plot.findById(m[1]);
      if (!plot) throw Object.assign(new Error('Plot not found'), { status: 404 });
      return AgronomicRecord.findOneAndUpdate(
        { plotId: plot._id },
        { $set: { ...body, plotId: plot._id, seasonId: plot.seasonId, setupId: plot.setupId, ownerId: ctx.ownerId } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    }
  },
  {
    method: 'POST',
    pattern: /^\/plots\/([^/]+)\/yields$/,
    handler: async (m, body, ctx) => {
      const plot = await Plot.findById(m[1]);
      if (!plot) throw Object.assign(new Error('Plot not found'), { status: 404 });
      await YieldRecord.create({
        ...body,
        remainingYield: 0,
        totalRevenue: 0,
        plotId: plot._id,
        seasonId: plot.seasonId,
        setupId: plot.setupId,
        ownerId: ctx.ownerId
      });
      const rows = await recomputePlotLedger(plot._id);
      return rows[rows.length - 1];
    }
  }
];

const UPDATE_ROUTES = [
  { method: 'PUT', pattern: /^\/plots\/([^/]+)$/, model: Plot },
  { method: 'PUT', pattern: /^\/seasons\/([^/]+)$/, model: Season },
  { method: 'PUT', pattern: /^\/setups\/([^/]+)$/, model: Setup },
  { method: 'PUT', pattern: /^\/costs\/([^/]+)$/, model: CostRecord },
  { method: 'PUT', pattern: /^\/labor\/([^/]+)$/, model: LaborRecord },
  { method: 'PUT', pattern: /^\/agronomic\/([^/]+)$/, model: AgronomicRecord },
  { method: 'PUT', pattern: /^\/yields\/([^/]+)$/, model: YieldRecord }
];

/**
 * Processes a single offline-queued record. Returns { serverId } on success,
 * throws { status, message } on failure, or returns { conflict: <doc> } on conflict.
 */
async function processRecord(record, ctx) {
  const { endpoint, method, body, timestamp } = record;

  if (method === 'POST') {
    const route = CREATE_ROUTES.find((r) => r.method === method && r.pattern.test(endpoint));
    if (!route) {
      throw Object.assign(new Error(`No sync handler for ${method} ${endpoint}`), { status: 400 });
    }
    const match = endpoint.match(route.pattern);
    const doc = await route.handler(match, body, ctx);
    return { serverId: doc._id };
  }

  if (method === 'PUT') {
    const route = UPDATE_ROUTES.find((r) => r.method === method && r.pattern.test(endpoint));
    if (!route) {
      throw Object.assign(new Error(`No sync handler for ${method} ${endpoint}`), { status: 400 });
    }
    const match = endpoint.match(route.pattern);
    const doc = await route.model.findById(match[1]);
    if (!doc) throw Object.assign(new Error('Record not found'), { status: 404 });

    if (timestamp && doc.updatedAt && new Date(doc.updatedAt) > new Date(timestamp)) {
      return { conflict: doc };
    }

    Object.assign(doc, body);
    await doc.save();
    return { serverId: doc._id };
  }

  throw Object.assign(new Error(`Unsupported sync method: ${method}`), { status: 400 });
}

/** POST /sync/batch */
async function syncBatch(req, res, next) {
  try {
    const { batchId = uuidv4(), records = [] } = req.body;
    const ctx = { ownerId: req.dbUser._id };

    const success = [];
    const failed = [];
    const conflicts = [];
    const logRecords = [];

    for (const record of records) {
      try {
        const result = await processRecord(record, ctx);
        if (result.conflict) {
          conflicts.push({ localId: record.localId, serverVersion: result.conflict });
          logRecords.push({ localId: record.localId, endpoint: record.endpoint, method: record.method, status: 'conflict' });
        } else {
          success.push({ localId: record.localId, serverId: result.serverId });
          logRecords.push({ localId: record.localId, endpoint: record.endpoint, method: record.method, status: 'success' });
        }
      } catch (err) {
        failed.push({ localId: record.localId, error: err.message });
        logRecords.push({ localId: record.localId, endpoint: record.endpoint, method: record.method, status: 'failed', error: err.message });
      }
    }

    await SyncLog.create({
      userId: req.dbUser._id,
      batchId,
      recordCount: records.length,
      successCount: success.length,
      failedCount: failed.length,
      records: logRecords,
      deviceInfo: req.headers['user-agent']
    });

    if (failed.length > 0) {
      const Notification = require('../models/Notification');
      await Notification.create({
        userId: req.dbUser._id,
        type: 'sync_failed',
        title: 'Some records failed to sync',
        message: `${failed.length} of ${records.length} records failed during batch sync.`,
        severity: 'warning'
      });
    }

    res.json({ batchId, success, failed, conflicts });
  } catch (err) {
    next(err);
  }
}

module.exports = { syncBatch };
