const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Research Mode only — time-based labour activity row (land prep, planting,
 * weeding, harvesting, ...). costType is recorder-supplied, same CP(i,t)
 * rule as TrialInputCost — never auto-classified. wageRatePerDayRwf/
 * workingHoursPerDay default from the Trial but are embedded per row (like
 * Farmer Mode's LaborRecord) so totalCostRwf derives from this document alone.
 */
const trialLaborCostSchema = new Schema(
  {
    trialPlotId: { type: Schema.Types.ObjectId, ref: 'TrialPlot', required: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User' },

    date: { type: Date, required: true },
    practice: { type: String, required: true, trim: true },
    costType: { type: String, enum: ['C_SD', 'C_SI'], required: true },
    numLabourers: { type: Number, required: true, min: 0 },
    timeValue: { type: Number, required: true, min: 0 },
    timeUnit: { type: String, enum: ['min', 'hr', 'sec'], required: true },
    wageRatePerDayRwf: { type: Number, required: true, min: 0 },
    workingHoursPerDay: { type: Number, required: true, min: 1, default: 8 },
    notes: String,

    timeMinutes: Number,
    totalCostRwf: Number
  },
  { timestamps: true }
);

trialLaborCostSchema.index({ trialPlotId: 1, date: 1 });

trialLaborCostSchema.pre('validate', function computeDerived(next) {
  const factor = { min: 1, hr: 60, sec: 1 / 60 }[this.timeUnit] ?? 0;
  this.timeMinutes = Math.round(this.timeValue * factor * 100) / 100;
  // Rounded to 6dp, not 2dp: this is a per-line-item cost that gets SUMMED
  // across many rows into plot/treatment totals downstream (researchAnalysis
  // engine, ANOVA, t-test). Rounding each row to the RWF cent first and then
  // summing compounds error (e.g. five fractional-minute rows landing 0.01+
  // off a total computed from unrounded inputs) — round only at final display.
  this.totalCostRwf =
    Math.round(
      (this.timeMinutes / (this.workingHoursPerDay * 60)) * this.wageRatePerDayRwf * this.numLabourers * 1e6
    ) / 1e6;
  next();
});

module.exports = mongoose.model('TrialLaborCost', trialLaborCostSchema);
