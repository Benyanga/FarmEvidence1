const mongoose = require('mongoose');
const { Schema } = mongoose;
const { classifyCostItem } = require('../engines/costClassifier.engine');

/**
 * Labour Costs — time-based activities (land prep, weeding, planting, harvest...).
 * laborCost is computed server-side from timeTaken/unit against the season's
 * shared laborSettings (wageRatePerDay, workingHoursPerDay) — see
 * engines/laborcost.engine.js. Multiple rows per activity are allowed (a
 * season may have several weeding events, for example). costClass is always
 * auto-derived from the activity name (see engines/costClassifier.engine.js),
 * not a field farmers/researchers fill in themselves.
 */
const laborRecordSchema = new Schema(
  {
    plotId: { type: Schema.Types.ObjectId, ref: 'Plot', required: true, index: true },
    seasonId: { type: Schema.Types.ObjectId, ref: 'Season' },
    setupId: { type: Schema.Types.ObjectId, ref: 'Setup' },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User' },

    date: { type: Date, required: true },
    activity: { type: String, required: true, trim: true },
    costClass: { type: String, enum: ['C_SD', 'C_SI'] },
    timeTaken: { type: Number, required: true, min: 0 },
    unit: { type: String, enum: ['days', 'hours', 'minutes'], required: true },
    wageRatePerDay: { type: Number, required: true, min: 0 },
    workingHoursPerDay: { type: Number, required: true, min: 1, default: 8 },
    laborCost: Number,

    notes: String
  },
  { timestamps: true }
);

laborRecordSchema.index({ plotId: 1, date: 1 });

laborRecordSchema.pre('validate', function deriveCostClass(next) {
  this.costClass = classifyCostItem(this.activity);
  next();
});

module.exports = mongoose.model('LaborRecord', laborRecordSchema);
