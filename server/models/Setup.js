const mongoose = require('mongoose');
const { Schema } = mongoose;

const setupSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },

    // Derived automatically from the owner's role at creation time — never user-selected.
    // farmer -> 'farm', researcher -> 'research_trial'. See setup.controller.js.
    setupType: {
      type: String,
      enum: ['farm', 'research_trial'],
      required: true
    },

    location: {
      country: { type: String, default: 'Rwanda' },
      district: String,
      sector: String,
      cell: String,
      village: String,
      gpsLat: Number,
      gpsLng: Number
    },

    rcbd: {
      numReplications: { type: Number, min: 2, max: 5 }
    },

    // Research Mode only — years the researcher has opened up for trials at
    // this site, shown as buttons in SetupDetail. Each year always exposes
    // Season A/B/C; seasons are lazily created on first click (see
    // season.controller.js's getOrCreateSeason).
    researchYears: [Number],

    // Farm dimensions in meters; area (m²) is auto-calculated as length × width.
    farmDimensions: {
      length: Number,
      width: Number
    },
    area: Number,

    adoptionStartSeason: { type: Number, required: true },

    soilType: String,
    rainfallPattern: String,
    description: String,

    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

setupSchema.index({ ownerId: 1, setupType: 1 });

module.exports = mongoose.model('Setup', setupSchema);
