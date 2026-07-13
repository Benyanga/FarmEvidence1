const mongoose = require('mongoose');
const { Schema } = mongoose;

const seasonSchema = new Schema(
  {
    setupId: { type: Schema.Types.ObjectId, ref: 'Setup', required: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User' },

    seasonNumber: { type: Number, required: true },
    seasonLabel: String,
    year: Number,
    seasonCode: { type: String, enum: ['A', 'B', 'C'] },

    // Farmer Mode only: one farming system per season — a season is either
    // CA or CF, never both. Not required at the schema level because
    // Research Mode seasons are just a time bucket (year + seasonCode) that
    // a Trial nests inside — treatments/comparison live on Trial/Treatment/
    // TrialPlot instead (see those models). Required-ness for Farmer Mode is
    // enforced in season.controller.js, not here.
    farmingSystem: { type: String, enum: ['CA', 'CF'] },

    cropType: { type: String },
    rowSpacing: {
      intraRow: Number, // cm, spacing between plants within a row
      interRow: Number // cm, spacing between rows
    },
    seedsPerHill: Number,
    cropPopulation: Number, // plants/ha, auto-calculated — see agronomy.engine.js

    // Farmer Mode only — labour-costing parameters for this season's Labour
    // Costs table (Research Mode's equivalent lives on Trial instead).
    laborSettings: {
      wageRatePerDay: Number, // RWF per 8hr day (default)
      workingHoursPerDay: { type: Number, default: 8 }
    },

    // Farmer Mode only — feeds csi.engine.js / efficiency.engine.js's
    // phase-adjusted cost model. Research Mode no longer uses CSI/phase.
    csiDrivers: {
      j1_marketAccess: { type: Number, min: 0, max: 1 },
      j2_climateReliability: { type: Number, min: 0, max: 1 },
      j3_soilQuality: { type: Number, min: 0, max: 1 },
      j4_inputAvailability: { type: Number, min: 0, max: 1 },
      j5_laborAvailability: { type: Number, min: 0, max: 1 },
      j6_institutionalSupport: { type: Number, min: 0, max: 1 }
    },

    // Farmer Mode only.
    computed: {
      csi: Number,
      phase: { type: String, enum: ['transition', 'stabilization', 'mature', 'pre-adoption'] },
      phi: Number,
      trends: {
        profitCA: String,
        profitCF: String,
        yieldCA: String,
        yieldCF: String,
        adoptionCost: String
      }
    },

    status: { type: String, enum: ['draft', 'in_progress', 'complete'], default: 'draft' },
    notes: String
  },
  { timestamps: true }
);

seasonSchema.index({ setupId: 1, seasonNumber: 1 }, { unique: true });

module.exports = mongoose.model('Season', seasonSchema);
