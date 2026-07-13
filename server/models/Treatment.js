const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Research Mode only — one treatment arm of a Trial. Every trial is a
 * Conservation Agriculture (CA) vs Conventional Farming (CF) comparison —
 * the two codes are the app-wide fixed identity every dashboard, chart, and
 * report colors/labels consistently (see docs/COMPUTATION_ENGINE.md).
 */
const treatmentSchema = new Schema(
  {
    trialId: { type: Schema.Types.ObjectId, ref: 'Trial', required: true, index: true },
    code: { type: String, required: true, trim: true, enum: ['CA', 'CF'] },
    label: { type: String, required: true, trim: true },
    description: String
  },
  { timestamps: true }
);

treatmentSchema.index({ trialId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('Treatment', treatmentSchema);
