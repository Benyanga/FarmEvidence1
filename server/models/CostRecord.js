const mongoose = require('mongoose');
const { Schema } = mongoose;
const { classifyCostItem } = require('../engines/costClassifier.engine');

/**
 * Input Costs — physical/material inputs (seed, compost, NPK, mulch, etc).
 * costClass classifies the input for RCBD cost-structure analysis and is
 * always auto-derived from inputName (see engines/costClassifier.engine.js) —
 * it is not a field farmers/researchers fill in themselves:
 *   C_SD (System Dependent) — cost differs by farming system (e.g. mulch acquisition)
 *   C_SI (System Independent) — cost is standardized across systems (e.g. seed, compost, NPK)
 */
const costRecordSchema = new Schema(
  {
    plotId: { type: Schema.Types.ObjectId, ref: 'Plot', required: true, index: true },
    seasonId: { type: Schema.Types.ObjectId, ref: 'Season' },
    setupId: { type: Schema.Types.ObjectId, ref: 'Setup' },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User' },

    date: { type: Date, required: true },
    inputName: { type: String, required: true, trim: true },
    costClass: { type: String, enum: ['C_SD', 'C_SI'] },
    unit: { type: String, enum: ['kg', 'L', 'bunches'], required: true },
    unitCost: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 0 },
    totalCost: Number
  },
  { timestamps: true }
);

costRecordSchema.index({ plotId: 1, date: 1 });

costRecordSchema.pre('validate', function computeTotalCost(next) {
  this.totalCost = Math.round(this.unitCost * this.quantity * 100) / 100;
  this.costClass = classifyCostItem(this.inputName);
  next();
});

module.exports = mongoose.model('CostRecord', costRecordSchema);
