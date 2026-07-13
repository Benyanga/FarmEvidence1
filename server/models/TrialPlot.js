const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Research Mode only — one plot = one (treatment, replicate/block) cell of
 * the RCBD grid. plotSizeM2 defaults from Trial.plotSizeM2 at creation and
 * is overridable per plot (see trial.controller.js's syncPlotGrid).
 */
const trialPlotSchema = new Schema(
  {
    trialId: { type: Schema.Types.ObjectId, ref: 'Trial', required: true, index: true },
    treatmentId: { type: Schema.Types.ObjectId, ref: 'Treatment', required: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User' },

    replicateNumber: { type: Number, min: 1, required: true },
    plotSizeM2: { type: Number, required: true },

    computed: {
      plotSizeHa: Number
    }
  },
  { timestamps: true }
);

trialPlotSchema.index({ trialId: 1, treatmentId: 1, replicateNumber: 1 }, { unique: true });

trialPlotSchema.pre('save', function deriveSize(next) {
  this.computed = { plotSizeHa: Math.round((this.plotSizeM2 / 10000) * 1e6) / 1e6 };
  next();
});

module.exports = mongoose.model('TrialPlot', trialPlotSchema);
