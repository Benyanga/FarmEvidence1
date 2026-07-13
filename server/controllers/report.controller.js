const Report = require('../models/Report');

async function listReports(req, res, next) {
  try {
    const filter = { ownerId: req.dbUser._id };
    if (req.query.setupId) filter.setupId = req.query.setupId;
    if (req.query.seasonId) filter.seasonId = req.query.seasonId;
    if (req.query.reportType) filter.reportType = req.query.reportType;
    const reports = await Report.find(filter).sort({ createdAt: -1 });
    res.json({ reports });
  } catch (err) {
    next(err);
  }
}

async function createReport(req, res, next) {
  try {
    const report = await Report.create({
      ...req.body,
      ownerId: req.dbUser._id,
      generatedBy: req.dbUser._id,
      generatedAt: new Date()
    });
    res.status(201).json({ report });
  } catch (err) {
    next(err);
  }
}

async function getReport(req, res, next) {
  try {
    const report = await Report.findOne({ _id: req.params.id, ownerId: req.dbUser._id });
    if (!report) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Report not found.' } });
    }
    res.json({ report });
  } catch (err) {
    next(err);
  }
}

async function deleteReport(req, res, next) {
  try {
    const report = await Report.findOneAndDelete({ _id: req.params.id, ownerId: req.dbUser._id });
    if (!report) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Report not found.' } });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { listReports, createReport, getReport, deleteReport };
