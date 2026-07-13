const mongoose = require('mongoose');
const { Schema } = mongoose;
const { computeTrialConfigDerived } = require('../engines/researchAnalysis.engine');

/**
 * Research Mode only — a generic t-treatments x b-replicates RCBD trial
 * living inside a Season (year + seasonCode time bucket). Unlike Farmer
 * Mode, a Trial owns its treatments and plots directly (see Treatment.js,
 * TrialPlot.js) rather than mapping one Season to one farmingSystem.
 */
const trialSchema = new Schema(
  {
    seasonId: { type: Schema.Types.ObjectId, ref: 'Season', required: true, index: true },
    setupId: { type: Schema.Types.ObjectId, ref: 'Setup', required: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User' },

    trialNumber: { type: Number, required: true },
    trialLabel: String,

    design: { type: String, enum: ['RCBD', 'CRD', 'split-plot'], default: 'RCBD' },
    numTreatments: { type: Number, min: 2, required: true },
    numReplicates: { type: Number, min: 2, max: 10, required: true },

    plotSizeM2: { type: Number, required: true },

    crop: { type: String, required: true },
    variety: String,
    plantingDate: Date,
    previousCrop: String,

    rowSpacing: {
      interRowCm: Number,
      intraRowCm: Number
    },
    seedsPerHill: Number,

    marketPriceRwfPerKg: Number,
    wageRatePerDayRwf: Number,
    workingHoursPerDay: { type: Number, default: 8 },

    significanceLevel: { type: Number, default: 0.05 },
    currency: { type: String, default: 'RWF' },
    district: String,
    site: String,

    computed: {
      extrapolationFactor: Number,
      plantingStationsPerPlot: Number,
      cropPopulationPerPlot: Number,
      cropPopulationPerHa: Number,
      dfError: Number,
      tCritical: Number
    },

    status: { type: String, enum: ['draft', 'in_progress', 'complete'], default: 'draft' },
    notes: String
  },
  { timestamps: true }
);

trialSchema.index({ setupId: 1, trialNumber: 1 }, { unique: true });

trialSchema.pre('save', function deriveConfig(next) {
  this.computed = computeTrialConfigDerived(this);
  next();
});

module.exports = mongoose.model('Trial', trialSchema);
