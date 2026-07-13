const mongoose = require('mongoose');
const { Schema } = mongoose;

/** Research Mode only — one yield/revenue entry per plot, recorded at harvest. */
const trialYieldSchema = new Schema(
  {
    trialPlotId: { type: Schema.Types.ObjectId, ref: 'TrialPlot', required: true, unique: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User' },

    yieldKg: { type: Number, required: true, min: 0 },
    priceRwfPerKg: { type: Number, required: true, min: 0 },

    grossRevenueRwf: Number
  },
  { timestamps: true }
);

trialYieldSchema.pre('validate', function computeRevenue(next) {
  this.grossRevenueRwf = Math.round(this.yieldKg * this.priceRwfPerKg * 100) / 100;
  next();
});

module.exports = mongoose.model('TrialYield', trialYieldSchema);
