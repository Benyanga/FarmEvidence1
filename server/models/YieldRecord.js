const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Yield & Revenue ledger — Farmer Mode only. Each row is a harvest event, a
 * sale event, or both. remainingYield/totalRevenue are a running balance
 * computed server-side (see engines/yieldLedger.engine.js) so that a
 * sale-only row (yieldHarvested = 0) subtracts from the previous remaining
 * balance rather than requiring a paired harvest row.
 */
const yieldRecordSchema = new Schema(
  {
    plotId: { type: Schema.Types.ObjectId, ref: 'Plot', required: true, index: true },
    seasonId: { type: Schema.Types.ObjectId, ref: 'Season' },
    setupId: { type: Schema.Types.ObjectId, ref: 'Setup' },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User' },

    date: { type: Date, required: true },
    yieldHarvested: { type: Number, default: 0, min: 0 },
    yieldSold: { type: Number, default: 0, min: 0 },
    marketPrice: { type: Number, min: 0 },
    remainingYield: Number,
    totalRevenue: Number
  },
  { timestamps: true }
);

yieldRecordSchema.index({ plotId: 1, date: 1, createdAt: 1 });

module.exports = mongoose.model('YieldRecord', yieldRecordSchema);
