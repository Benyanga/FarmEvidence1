const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema(
  {
    clerkId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true },
    displayName: String,
    role: {
      type: String,
      enum: ['farmer', 'researcher'],
      required: true
    },
    preferredLanguage: {
      type: String,
      enum: ['en', 'rw'],
      default: 'en'
    }
  },
  { timestamps: true }
);

userSchema.index({ role: 1 });

module.exports = mongoose.model('User', userSchema);
