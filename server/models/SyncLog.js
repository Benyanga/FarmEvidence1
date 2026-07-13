const mongoose = require('mongoose');
const { Schema } = mongoose;

const syncLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    batchId: { type: String, unique: true, required: true },
    recordCount: Number,
    successCount: Number,
    failedCount: Number,
    records: [
      {
        localId: String,
        endpoint: String,
        method: String,
        status: { type: String, enum: ['success', 'failed', 'conflict'] },
        error: String
      }
    ],
    syncedAt: { type: Date, default: Date.now },
    deviceInfo: String
  },
  { timestamps: false }
);

module.exports = mongoose.model('SyncLog', syncLogSchema);
