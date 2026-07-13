const mongoose = require('mongoose');
const { Schema } = mongoose;

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    setupId: { type: Schema.Types.ObjectId, ref: 'Setup' },
    seasonId: { type: Schema.Types.ObjectId, ref: 'Season' },

    type: {
      type: String,
      enum: [
        'season_start',
        'season_end',
        'data_entry_due',
        'profit_below_threshold',
        'csi_critical',
        'ttp_milestone',
        'trend_worsening',
        'missing_data',
        'sync_failed'
      ],
      required: true
    },

    title: { type: String, required: true },
    message: { type: String, required: true },
    severity: { type: String, enum: ['info', 'warning', 'alert'], default: 'info' },
    read: { type: Boolean, default: false },
    readAt: Date,

    actionLink: String,

    expiresAt: Date
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
