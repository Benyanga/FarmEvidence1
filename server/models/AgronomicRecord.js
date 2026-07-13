const mongoose = require('mongoose');
const { Schema } = mongoose;

const valueUnit = (defaultUnit) => ({
  value: Number,
  unit: { type: String, default: defaultUnit }
});

const agronomicRecordSchema = new Schema(
  {
    plotId: { type: Schema.Types.ObjectId, ref: 'Plot', required: true, index: true },
    seasonId: { type: Schema.Types.ObjectId, ref: 'Season', index: true },
    setupId: { type: Schema.Types.ObjectId, ref: 'Setup' },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User' },

    biomassYield: valueUnit('kg/ha'),
    grainYield: valueUnit('kg/ha'),
    soilOrganicCarbon: valueUnit('%'),
    soilMoisture: valueUnit('%'),
    plantHeight: valueUnit('cm'),
    leafAreaIndex: valueUnit('LAI'),
    erosionScore: valueUnit('score'),
    soilScore: valueUnit('score'),
    earthwormCount: valueUnit('count'),
    weedPressureScore: valueUnit('score'),

    observationDate: Date,
    growthStage: String,
    notes: String
  },
  { timestamps: true }
);

agronomicRecordSchema.index({ plotId: 1, seasonId: 1 }, { unique: true });

module.exports = mongoose.model('AgronomicRecord', agronomicRecordSchema);
