const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Research Mode only — physical/material input cost row (seed, mulch,
 * compost, NPK, pesticide, ...). Unlike Farmer Mode's CostRecord, costType
 * is supplied by the recorder at entry time (the CP(i,t) rule: cost-system-
 * independence is assigned per category, per season, by the recorder — not
 * auto-classified globally by keyword).
 */
const trialInputCostSchema = new Schema(
  {
    trialPlotId: { type: Schema.Types.ObjectId, ref: 'TrialPlot', required: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User' },

    date: { type: Date, required: true },
    inputItem: { type: String, required: true, trim: true },
    costType: { type: String, enum: ['C_SD', 'C_SI'], required: true },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true, trim: true },
    unitCostRwf: { type: Number, required: true, min: 0 },
    notes: String,

    totalCostRwf: Number
  },
  { timestamps: true }
);

trialInputCostSchema.index({ trialPlotId: 1, date: 1 });

trialInputCostSchema.pre('validate', function computeTotal(next) {
  this.totalCostRwf = Math.round(this.unitCostRwf * this.quantity * 100) / 100;
  next();
});

module.exports = mongoose.model('TrialInputCost', trialInputCostSchema);
