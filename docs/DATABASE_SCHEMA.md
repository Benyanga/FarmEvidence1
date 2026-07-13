# Database Schema — FarmEvidence Platform

MongoDB Atlas · Database: `farmevidence`

---

## Collections Overview

| Collection | Description |
|---|---|
| `users` | Clerk user sync + role + preferences |
| `setups` | Farm / Research trial configurations |
| `seasons` | Season records per setup (Farmer Mode: the CA/CF unit itself; Research Mode: a pure time bucket a Trial nests inside) |
| `plots` | **Farmer Mode only** — one implicit plot per season |
| `costRecords` | **Farmer Mode only** — cost entries per plot/season |
| `laborRecords` | **Farmer Mode only** — disaggregated labor by operation per plot/season |
| `agronomicRecords` | 7 agronomic indicator measurements per plot/season (both modes) |
| `trials` | **Research Mode only** — a t-treatments × b-replicates RCBD trial, see §11–§15 |
| `treatments` | **Research Mode only** — the Treatment Register for a trial |
| `trialPlots` | **Research Mode only** — one plot per (treatment, replicate) cell |
| `trialInputCosts` / `trialLaborCosts` | **Research Mode only** — recorder-tagged (`C_SD`/`C_SI`) cost logs per trial plot |
| `trialYields` | **Research Mode only** — one yield/revenue entry per trial plot |
| `notifications` | Time-based and condition-based alerts |
| `reports` | Report metadata (PDF generated client-side) |
| `syncLogs` | Audit log for offline sync batch operations |

---

## 1. `users`

```javascript
{
  _id: ObjectId,
  clerkId: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true },
  displayName: String,
  role: {
    type: String,
    enum: ['farmer', 'researcher', 'extensionist'],
    required: true
  },
  preferredLanguage: {
    type: String,
    enum: ['en', 'rw'],
    default: 'en'
  },
  extensionistId: ObjectId,      // for farmers: which extensionist manages them
  ffsGroupId: ObjectId,          // for farmers: which FFS group
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**: `clerkId` (unique), `role`

---

## 2. `setups`

Represents a farm, FFS group, or research trial — the top-level container.

```javascript
{
  _id: ObjectId,
  ownerId: { type: ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true },
  setupType: {
    type: String,
    enum: ['farm', 'research_trial'],
    required: true
  },
  // Determines mode: farm → Farmer Mode; research_trial → Research Mode
  // ('ffs' does not exist in the actual Setup.js enum — removing a stale
  // reference from this doc; there is no FFS setup type implemented.)

  location: {
    country: String,
    district: String,
    sector: String,
    village: String,
    gpsLat: Number,
    gpsLng: Number
  },

  // Research trial fields (only if setupType === 'research_trial')
  rcbd: {
    numReplications: { type: Number, min: 2, max: 5 },
    treatments: [{ type: String, enum: ['CA', 'CF', 'CA+', 'CF+'] }]
  },

  // FFS group fields (only if setupType === 'ffs')
  ffsGroup: {
    extensionistId: ObjectId,
    memberIds: [ObjectId],
    groupName: String
  },

  adoptionStartSeason: {
    type: Number,
    required: true,
    comment: 'The season number (1-indexed) when CA adoption began'
  },

  cropType: String,
  soilType: String,
  rainfallPattern: String,       // CSI driver j2 source
  description: String,

  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**: `ownerId`, `setupType`, compound `{ ownerId, setupType }`

---

## 3. `seasons`

One record per growing season per setup.

```javascript
{
  _id: ObjectId,
  setupId: { type: ObjectId, ref: 'Setup', required: true, index: true },
  ownerId: ObjectId,

  seasonNumber: { type: Number, required: true },   // 1-indexed; used to derive phase
  seasonLabel: String,                               // e.g. "Season A 2024"
  year: Number,
  seasonCode: { type: String, enum: ['A', 'B'] },   // Rwanda: Season A (Jan-Jun), B (Jul-Dec)

  // CSI Driver inputs (collected per season)
  csiDrivers: {
    j1_marketAccess: { type: Number, min: 0, max: 1 },       // weight 0.25
    j2_climateReliability: { type: Number, min: 0, max: 1 }, // weight 0.20
    j3_soilQuality: { type: Number, min: 0, max: 1 },        // weight 0.15
    j4_inputAvailability: { type: Number, min: 0, max: 1 },  // weight 0.15
    j5_laborAvailability: { type: Number, min: 0, max: 1 },  // weight 0.15
    j6_institutionalSupport: { type: Number, min: 0, max: 1 }// weight 0.10
  },

  // Computed (stored after engine run)
  computed: {
    csi: Number,                  // CSI ∈ [0,1]
    phase: {
      type: String,
      enum: ['transition', 'stabilization', 'mature']
    },
    phi: Number,                  // φ(t): 0.30, 0.70, or 1.00

    // Trends (computed by trend engine across seasons)
    trends: {
      profitCA: String,           // Improving|Declining|Volatile|Stable|Insufficient
      profitCF: String,
      yieldCA: String,
      yieldCF: String,
      adoptionCost: String
    }
  },

  status: { type: String, enum: ['draft', 'in_progress', 'complete'], default: 'draft' },
  notes: String,
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**: `setupId`, compound `{ setupId, seasonNumber }` (unique)

---

## 4. `plots` (Farmer Mode only)

Research Mode no longer uses this collection — see `trialPlots` (§13) for the
t-treatments × b-replicates grid. A Farmer Mode season maps to exactly one
implicit plot (no treatment field on the plot itself; the season's
`farmingSystem` is the treatment).

```javascript
{
  _id: ObjectId,
  seasonId: { type: ObjectId, ref: 'Season', required: true, index: true },
  setupId: ObjectId,
  ownerId: ObjectId,

  treatment: {
    type: String,
    enum: ['CA', 'CF', 'CA+', 'CF+'],
    required: true
  },
  replicationNumber: {
    type: Number,
    min: 1, max: 5,
    default: 1
    // In Farmer Mode: always 1 (single farm plot)
    // In Research Mode: 1–5 replications
  },
  plotArea: { type: Number, required: true }, // hectares

  // Yield (observed only — NEVER imputed)
  yield: {
    value: Number,               // kg
    unit: { type: String, default: 'kg' },
    isObserved: { type: Boolean, default: true }
  },

  // Price (observed only)
  sellingPrice: {
    value: Number,               // RWF per kg
    currency: { type: String, default: 'RWF' }
  },

  // Computed revenue (stored for quick access)
  revenue: Number,               // = yield.value × sellingPrice.value

  // Computed CBA outputs (stored after engine run)
  computed: {
    cBase: Number,
    cSys: Number,
    cTime: Number,
    cSystem: Number,             // = C_base + C_sys + C_time
    profit: Number,              // = Revenue - C_system
    adoptionCost: Number,        // empirically derived
    ttp: Number,                 // season number when CA profit > CF profit
    cnb: Number                  // cumulative net benefit
  },

  // Efficiency model outputs
  efficiency: {
    eMax: Number,                // maximum efficiency for this treatment
    eiTS: Number,                // E_i(t,S) = E_max × φ(t) × CSI(S)
    qCAi: Number                 // Q_CA,i(t) = Q_CF,i × [1 - E_i(t,S)]
  },

  notes: String,
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**: `seasonId`, compound `{ seasonId, treatment, replicationNumber }` (unique)

---

## 5. `costRecords`

System-driven variable costs per plot per season. Six allowed categories only.

```javascript
{
  _id: ObjectId,
  plotId: { type: ObjectId, ref: 'Plot', required: true, index: true },
  seasonId: ObjectId,
  setupId: ObjectId,
  ownerId: ObjectId,

  costCategory: {
    type: String,
    enum: ['tillage', 'fertilizer', 'pesticide', 'irrigation', 'residueManagement', 'labor'],
    required: true
    // NOTE: 'labor' here is the TOTAL if entered aggregated
    // Disaggregated labor comes from laborRecords collection
    // If laborRecords exist for this plot/season, this entry for 'labor' must NOT exist
  },

  amount: { type: Number, required: true },   // RWF
  quantity: Number,                            // optional: kg, liters, etc.
  unit: String,                                // optional: 'kg', 'L', 'ha'
  unitCost: Number,                            // optional: price per unit
  description: String,

  // Off-farm costs are EXCLUDED — enforced by enum above
  // Transport, storage, taxes, fees → not in this system

  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**: `plotId`, `seasonId`, compound `{ plotId, costCategory }`

---

## 6. `laborRecords`

Disaggregated labor by the 5 standard operations. Presence of these records prevents aggregated labor `costRecord`.

```javascript
{
  _id: ObjectId,
  plotId: { type: ObjectId, ref: 'Plot', required: true, index: true },
  seasonId: ObjectId,
  setupId: ObjectId,
  ownerId: ObjectId,

  operation: {
    type: String,
    enum: ['landPrep', 'planting', 'weeding', 'harvesting', 'residueManagement'],
    required: true
    // LP = Land Preparation
    // PL = Planting
    // WD = Weeding
    // HV = Harvesting
    // RM = Residue Management
  },

  laborDays: { type: Number, required: true },   // person-days
  wageRate: { type: Number, required: true },    // RWF per person-day
  laborCost: Number,                             // = laborDays × wageRate (computed + stored)

  // Gender disaggregation (optional)
  maleLaborDays: Number,
  femaleLaborDays: Number,

  notes: String,
  createdAt: Date,
  updatedAt: Date
}
```

**Computed**: `C_labor = SUM(laborCost) across all 5 operations for a given plotId`

**Constraint**: If any `laborRecord` exists for a `plotId`, the `costRecords` for that `plotId` must not contain a `labor` category entry. Enforced in `cost.controller.js`.

---

## 7. `agronomicRecords`

Seven agronomic indicators per plot per season. All observed, never imputed.

```javascript
{
  _id: ObjectId,
  plotId: { type: ObjectId, ref: 'Plot', required: true, index: true },
  seasonId: ObjectId,
  setupId: ObjectId,
  ownerId: ObjectId,

  // The 7 indicators (all optional individually but tracked for completeness)
  biomassYield: {
    value: Number,           // kg/ha
    unit: { type: String, default: 'kg/ha' }
  },
  grainYield: {
    value: Number,           // kg/ha
    unit: { type: String, default: 'kg/ha' }
  },
  soilOrganicCarbon: {
    value: Number,           // %
    unit: { type: String, default: '%' }
  },
  soilMoisture: {
    value: Number,           // %
    unit: { type: String, default: '%' }
  },
  plantHeight: {
    value: Number,           // cm
    unit: { type: String, default: 'cm' }
  },
  leafAreaIndex: {
    value: Number,           // dimensionless
    unit: { type: String, default: 'LAI' }
  },
  erosionScore: {
    value: Number,           // 1–5 scale
    unit: { type: String, default: 'score' }
  },

  observationDate: Date,
  growthStage: String,       // BBCH or descriptive stage
  notes: String,

  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**: `plotId`, `seasonId`, compound `{ plotId, seasonId }` (unique)

---

## 8. `notifications`

```javascript
{
  _id: ObjectId,
  userId: { type: ObjectId, ref: 'User', required: true, index: true },
  setupId: ObjectId,
  seasonId: ObjectId,

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
    ]
  },

  title: String,
  message: String,
  severity: { type: String, enum: ['info', 'warning', 'alert'], default: 'info' },
  read: { type: Boolean, default: false },
  readAt: Date,

  // Metadata for deep-linking
  actionLink: String,           // e.g. /seasons/63abc/cba

  createdAt: Date,
  expiresAt: Date
}
```

**Indexes**: `userId`, `read`, compound `{ userId, read, createdAt }`

---

## 9. `reports`

PDF is generated client-side (pdfmake). Only metadata stored server-side.

```javascript
{
  _id: ObjectId,
  ownerId: ObjectId,
  setupId: ObjectId,
  seasonId: ObjectId,         // null for multi-season reports

  reportType: {
    type: String,
    enum: ['seasonal_cba', 'trend_analysis', 'statistical', 'full_season', 'comparative']
  },
  title: String,
  generatedAt: Date,
  generatedBy: ObjectId,       // userId

  // Snapshot of key computed values at report time (for audit)
  snapshot: {
    profitCA: Number,
    profitCF: Number,
    adoptionCost: Number,
    csi: Number,
    ttp: Number,
    cnb: Number
  },

  language: { type: String, enum: ['en', 'rw'], default: 'en' },
  createdAt: Date
}
```

---

## 10. `syncLogs`

Audit trail for offline batch sync operations.

```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  batchId: { type: String, unique: true },   // UUID generated per sync attempt
  recordCount: Number,
  successCount: Number,
  failedCount: Number,
  records: [{
    localId: String,           // IndexedDB record ID
    endpoint: String,
    method: String,
    status: { type: String, enum: ['success', 'failed', 'conflict'] },
    error: String
  }],
  syncedAt: Date,
  deviceInfo: String
}
```

---

## 11. `trials` (Research Mode only)

Generic t-treatments × b-replicates RCBD trial, nested inside a Season (time bucket).

```javascript
{
  _id: ObjectId,
  seasonId: { type: ObjectId, ref: 'Season', required: true, index: true },
  setupId: { type: ObjectId, ref: 'Setup', required: true, index: true },
  ownerId: ObjectId,

  trialNumber: { type: Number, required: true },   // sequential within the setup, display only
  trialLabel: String,

  design: { type: String, enum: ['RCBD', 'CRD', 'split-plot'], default: 'RCBD' },
  numTreatments: { type: Number, min: 2, required: true },
  numReplicates: { type: Number, min: 2, max: 10, required: true },
  plotSizeM2: { type: Number, required: true },

  crop: { type: String, required: true },
  variety: String,
  plantingDate: Date,
  previousCrop: String,
  rowSpacing: { interRowCm: Number, intraRowCm: Number },
  seedsPerHill: Number,

  marketPriceRwfPerKg: Number,
  wageRatePerDayRwf: Number,
  workingHoursPerDay: { type: Number, default: 8 },
  significanceLevel: { type: Number, default: 0.05 },   // α
  currency: { type: String, default: 'RWF' },
  district: String,
  site: String,

  // Derived on every save — see COMPUTATION_ENGINE.md §11.1
  computed: {
    extrapolationFactor: Number,
    plantingStationsPerPlot: Number,
    cropPopulationPerPlot: Number,
    cropPopulationPerHa: Number,
    dfError: Number,
    tCritical: Number
  },

  status: { type: String, enum: ['draft', 'in_progress', 'complete'], default: 'draft' },
  notes: String,
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**: `seasonId`, `setupId`, compound `{ setupId, trialNumber }` (unique)

---

## 12. `treatments` (Research Mode only)

The Treatment Register for a trial (e.g. T1/CA, T2/CF, T3/CA+compost).

```javascript
{
  _id: ObjectId,
  trialId: { type: ObjectId, ref: 'Trial', required: true, index: true },
  code: { type: String, required: true, trim: true },
  label: { type: String, required: true, trim: true },
  description: String,
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**: `trialId`, compound `{ trialId, code }` (unique)

---

## 13. `trialPlots` (Research Mode only)

One document per (treatment, replicate) cell — the RCBD grid.

```javascript
{
  _id: ObjectId,
  trialId: { type: ObjectId, ref: 'Trial', required: true, index: true },
  treatmentId: { type: ObjectId, ref: 'Treatment', required: true, index: true },
  ownerId: ObjectId,

  replicateNumber: { type: Number, min: 1, required: true },
  plotSizeM2: { type: Number, required: true },   // defaults from Trial.plotSizeM2, overridable

  computed: { plotSizeHa: Number },
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**: `trialId`, `treatmentId`, compound `{ trialId, treatmentId, replicateNumber }` (unique)

---

## 14. `trialInputCosts` / `trialLaborCosts` (Research Mode only)

Physical-input and labour-activity cost rows per trial plot. Unlike Farmer
Mode's `costRecords`/`laborRecords`, **`costType` is supplied by the recorder
at entry time, never auto-classified** — the CP(i,t) rule: cost-system-
independence is assigned per category, per season, by the recorder.

```javascript
// trialInputCosts
{
  _id: ObjectId,
  trialPlotId: { type: ObjectId, ref: 'TrialPlot', required: true, index: true },
  ownerId: ObjectId,
  date: { type: Date, required: true },
  inputItem: { type: String, required: true, trim: true },
  costType: { type: String, enum: ['C_SD', 'C_SI'], required: true },
  quantity: { type: Number, required: true, min: 0 },
  unit: { type: String, required: true, trim: true },
  unitCostRwf: { type: Number, required: true, min: 0 },
  notes: String,
  totalCostRwf: Number,   // = quantity × unitCostRwf, auto-derived
  createdAt: Date,
  updatedAt: Date
}

// trialLaborCosts
{
  _id: ObjectId,
  trialPlotId: { type: ObjectId, ref: 'TrialPlot', required: true, index: true },
  ownerId: ObjectId,
  date: { type: Date, required: true },
  practice: { type: String, required: true, trim: true },
  costType: { type: String, enum: ['C_SD', 'C_SI'], required: true },
  numLabourers: { type: Number, required: true, min: 0 },
  timeValue: { type: Number, required: true, min: 0 },
  timeUnit: { type: String, enum: ['min', 'hr', 'sec'], required: true },
  wageRatePerDayRwf: { type: Number, required: true, min: 0 },     // defaults from Trial
  workingHoursPerDay: { type: Number, required: true, min: 1, default: 8 },
  notes: String,
  timeMinutes: Number,      // auto-derived
  totalCostRwf: Number,     // auto-derived
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**: `{ trialPlotId, date }` on both collections

---

## 15. `trialYields` (Research Mode only)

One yield/revenue entry per trial plot, recorded at harvest.

```javascript
{
  _id: ObjectId,
  trialPlotId: { type: ObjectId, ref: 'TrialPlot', required: true, unique: true, index: true },
  ownerId: ObjectId,
  yieldKg: { type: Number, required: true, min: 0 },
  priceRwfPerKg: { type: Number, required: true, min: 0 },   // defaults from Trial.marketPriceRwfPerKg
  grossRevenueRwf: Number,   // = yieldKg × priceRwfPerKg, auto-derived
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**: `trialPlotId` (unique)

---

## Indexes Summary

```javascript
// users
db.users.createIndex({ clerkId: 1 }, { unique: true })

// setups
db.setups.createIndex({ ownerId: 1 })
db.setups.createIndex({ setupType: 1 })

// seasons
db.seasons.createIndex({ setupId: 1 })
db.seasons.createIndex({ setupId: 1, seasonNumber: 1 }, { unique: true })

// plots
db.plots.createIndex({ seasonId: 1 })
db.plots.createIndex({ seasonId: 1, treatment: 1, replicationNumber: 1 }, { unique: true })

// costRecords
db.costRecords.createIndex({ plotId: 1 })
db.costRecords.createIndex({ plotId: 1, costCategory: 1 })

// laborRecords
db.laborRecords.createIndex({ plotId: 1 })
db.laborRecords.createIndex({ plotId: 1, operation: 1 }, { unique: true })

// agronomicRecords
db.agronomicRecords.createIndex({ plotId: 1, seasonId: 1 }, { unique: true })

// notifications
db.notifications.createIndex({ userId: 1, read: 1, createdAt: -1 })

// trials (Research Mode)
db.trials.createIndex({ seasonId: 1 })
db.trials.createIndex({ setupId: 1 })
db.trials.createIndex({ setupId: 1, trialNumber: 1 }, { unique: true })

// treatments
db.treatments.createIndex({ trialId: 1 })
db.treatments.createIndex({ trialId: 1, code: 1 }, { unique: true })

// trialPlots
db.trialPlots.createIndex({ trialId: 1 })
db.trialPlots.createIndex({ treatmentId: 1 })
db.trialPlots.createIndex({ trialId: 1, treatmentId: 1, replicateNumber: 1 }, { unique: true })

// trialInputCosts / trialLaborCosts
db.trialInputCosts.createIndex({ trialPlotId: 1, date: 1 })
db.trialLaborCosts.createIndex({ trialPlotId: 1, date: 1 })

// trialYields
db.trialYields.createIndex({ trialPlotId: 1 }, { unique: true })
```
