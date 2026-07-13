const mongoose = require('mongoose');
const { Schema } = mongoose;

const reportSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    setupId: { type: Schema.Types.ObjectId, ref: 'Setup' },
    seasonId: { type: Schema.Types.ObjectId, ref: 'Season', default: null },
    trialId: { type: Schema.Types.ObjectId, ref: 'Trial', default: null },

    reportType: {
      type: String,
      enum: ['seasonal_cba', 'trend_analysis', 'statistical', 'full_season', 'comparative', 'research_analysis'],
      required: true
    },
    title: { type: String, required: true },
    generatedAt: { type: Date, default: Date.now },
    generatedBy: { type: Schema.Types.ObjectId, ref: 'User' },

    // Flexible — farmer seasonal_cba snapshots carry the full raw-data + CBA
    // indicator set, research_analysis snapshots carry the full tabulation.
    snapshot: Schema.Types.Mixed,

    language: { type: String, enum: ['en', 'rw'], default: 'en' }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model('Report', reportSchema);
