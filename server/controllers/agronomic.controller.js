const AgronomicRecord = require('../models/AgronomicRecord');
const Plot = require('../models/Plot');

async function getAgronomic(req, res, next) {
  try {
    const agronomic = await AgronomicRecord.findOne({ plotId: req.params.plotId });
    res.json({ agronomic });
  } catch (err) {
    next(err);
  }
}

async function upsertAgronomic(req, res, next) {
  try {
    const plot = await Plot.findById(req.params.plotId);
    if (!plot) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Plot not found.' } });
    }

    const agronomic = await AgronomicRecord.findOneAndUpdate(
      { plotId: plot._id },
      {
        $set: {
          ...req.body,
          plotId: plot._id,
          seasonId: plot.seasonId,
          setupId: plot.setupId,
          ownerId: req.dbUser._id
        }
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({ agronomic });
  } catch (err) {
    next(err);
  }
}

async function updateAgronomic(req, res, next) {
  try {
    const agronomic = await AgronomicRecord.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
    if (!agronomic) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Agronomic record not found.' } });
    }
    res.json({ agronomic });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAgronomic, upsertAgronomic, updateAgronomic };
