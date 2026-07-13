const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Farmer Mode only. A farm season maps to a single implicit plot (no
 * treatment comparison) — see season.controller.js's auto-creation. Research
 * Mode trials use Trial/Treatment/TrialPlot instead (see those models).
 */
const plotSchema = new Schema(
  {
    seasonId: { type: Schema.Types.ObjectId, ref: 'Season', required: true, index: true },
    setupId: { type: Schema.Types.ObjectId, ref: 'Setup' },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User' },

    replicationNumber: { type: Number, min: 1, max: 10, default: 1 },
    plotArea: { type: Number, required: true },

    yield: {
      value: Number,
      unit: { type: String, default: 'kg' },
      isObserved: { type: Boolean, default: true }
    },

    sellingPrice: {
      value: Number,
      currency: { type: String, default: 'RWF' }
    },

    revenue: Number,

    computed: {
      cBase: Number,
      cSD: Number,
      cSI: Number,
      cSys: Number,
      cTime: Number,
      cSystem: Number,
      profit: Number,
      grossMargin: Number,
      adjustedGrossMargin: Number,
      bcr: Number,
      roi: Number,
      costPerKg: Number,
      breakEvenYield: Number,
      yieldMarginOfSafety: Number,
      adoptionCost: Number,
      canCompute: Boolean,
      missingData: [String]
    },

    notes: String
  },
  { timestamps: true }
);

// One plot per season, uniqueness is simply per-season-per-block.
plotSchema.index({ seasonId: 1, replicationNumber: 1 }, { unique: true });

module.exports = mongoose.model('Plot', plotSchema);
