# API Specification — FarmEvidence Platform

Base URL: `https://<your-render-domain>.onrender.com/api`
Local: `http://localhost:5000/api`

All endpoints (except `/auth/sync-user`) require:
```
Authorization: Bearer <clerk-session-token>
Content-Type: application/json
```

---

## Auth Middleware Stack

Every request passes through:
1. `auth.js` — Verifies Clerk JWT, attaches `req.user = { clerkId, role, email }`
2. `roleGuard.js` — Used on routes that restrict to specific roles
3. `modeGuard.js` — Enforces Farmer vs Research mode on every Trial/TrialPlot/Research-analysis route and on `/compute/season/:seasonId`

---

## 1. Authentication Routes

### `POST /auth/sync-user`
Upserts the Clerk user into MongoDB on first login and on session refresh.

**Request**
```json
{ "displayName": "Jean Baptiste" }
```

**Response**
```json
{
  "user": {
    "_id": "...",
    "clerkId": "user_abc123",
    "email": "jb@example.com",
    "role": "farmer",
    "displayName": "Jean Baptiste",
    "preferredLanguage": "rw"
  }
}
```

---

## 2. Setup Routes

### `GET /setups`
Returns all setups owned by the authenticated user.

**Response**
```json
{
  "setups": [
    { "_id": "...", "name": "Kirehe Farm A", "setupType": "farm", "adoptionStartSeason": 3, ... }
  ]
}
```

### `POST /setups`
```json
{
  "name": "Kirehe Research Trial 2024",
  "setupType": "research_trial",
  "location": { "district": "Kirehe", "sector": "Mpanga" },
  "adoptionStartSeason": 1,
  "rcbd": { "numReplications": 3, "treatments": ["CA", "CF"] },
  "cropType": "Maize",
  "soilType": "Clay loam"
}
```

**Response**: `201 Created` with created setup document.

### `GET /setups/:id`
Single setup with populated season list.

### `PUT /setups/:id`
Update setup metadata (not RCBD structure after seasons exist).

### `DELETE /setups/:id`
Soft-delete (sets `active: false`). Cascades to seasons/plots logically.

---

## 3. Season Routes

### `GET /setups/:setupId/seasons`
All seasons for a setup, sorted by `seasonNumber`.

### `POST /setups/:setupId/seasons`
```json
{
  "seasonNumber": 4,
  "seasonLabel": "Season A 2024",
  "year": 2024,
  "seasonCode": "A",
  "csiDrivers": {
    "j1_marketAccess": 0.7,
    "j2_climateReliability": 0.6,
    "j3_soilQuality": 0.5,
    "j4_inputAvailability": 0.8,
    "j5_laborAvailability": 0.65,
    "j6_institutionalSupport": 0.4
  }
}
```

### `GET /seasons/:id`
Single season with computed fields.

### `PUT /seasons/:id`
Update season (including CSI driver scores).

### `DELETE /seasons/:id`
Delete season and all associated plots/records.

---

## 4. Plot Routes

### `GET /seasons/:seasonId/plots`
All plots for a season.

### `POST /seasons/:seasonId/plots`
```json
{
  "treatment": "CA",
  "replicationNumber": 1,
  "plotArea": 0.5,
  "yield": { "value": 2400, "unit": "kg" },
  "sellingPrice": { "value": 350, "currency": "RWF" }
}
```

### `GET /plots/:id`
Single plot with all associated records.

### `PUT /plots/:id`
Update plot (yield, price, area).

### `DELETE /plots/:id`

---

## 5. Cost Routes

### `GET /plots/:plotId/costs`
All cost records for a plot (system-driven costs + labor summary).

### `POST /plots/:plotId/costs`
```json
{
  "costCategory": "fertilizer",
  "amount": 45000,
  "quantity": 50,
  "unit": "kg",
  "unitCost": 900,
  "description": "NPK 17-17-17"
}
```

**Validation**: `costCategory` must be one of `['tillage','fertilizer','pesticide','irrigation','residueManagement','labor']`. If `laborRecords` exist for this plot, `labor` category is rejected.

### `PUT /costs/:id`
### `DELETE /costs/:id`

---

## 6. Labor Routes

### `GET /plots/:plotId/labor`
All labor records for a plot (5 operations).

### `POST /plots/:plotId/labor`
```json
{
  "operation": "weeding",
  "laborDays": 12,
  "wageRate": 2000,
  "maleLaborDays": 7,
  "femaleLaborDays": 5
}
```

**Validation**: Each `operation` unique per plotId. Creating labor records for a plot auto-invalidates any existing `labor` costRecord for that plot (server removes it and logs the action).

### `PUT /labor/:id`
### `DELETE /labor/:id`

---

## 7. Agronomic Routes

### `GET /plots/:plotId/agronomic`
Agronomic record for a plot/season.

### `POST /plots/:plotId/agronomic`
```json
{
  "biomassYield": { "value": 4200 },
  "grainYield": { "value": 2400 },
  "soilOrganicCarbon": { "value": 1.8 },
  "soilMoisture": { "value": 32 },
  "plantHeight": { "value": 145 },
  "leafAreaIndex": { "value": 3.2 },
  "erosionScore": { "value": 2 },
  "observationDate": "2024-05-15",
  "growthStage": "R4"
}
```

### `PUT /agronomic/:id`

---

## 8. Computation Routes — Farmer Mode

All return computed results + explanation objects. Results are also stored back to the plot/season document. Guarded to Farmer Mode setups (`modeGuard({ require: 'farmer' })`) — Research Mode's computation lives under §12 Trial Routes instead.

### `POST /compute/season/:seasonId`
Runs the full computation pipeline for all plots in a season.

**Response**
```json
{
  "seasonId": "...",
  "farmingSystem": "CA",
  "plots": [
    {
      "plotId": "...",
      "cBase": 125000,
      "cSystem": 125000,
      "revenue": 840000,
      "profit": 715000,
      "adoptionCost": 0,
      "explanation": {
        "what": "...", "why": "...", "how": "...", "recommendation": "..."
      }
    }
  ],
  "trends": { "profitCA": "Improving", "yieldCA": "Stable" }
}
```

### `POST /compute/scenarios/:plotId`
```json
// Request body (optional overrides)
{
  "bestYieldAdj": 0.15,
  "bestPriceAdj": 0.10,
  "bestCostAdj": -0.10,
  "worstYieldAdj": -0.20,
  "worstPriceAdj": -0.15,
  "worstCostAdj": 0.15
}

// Response
{
  "scenarios": {
    "best":   { "probability": 0.32, "profit": 920000 },
    "normal": { "probability": 0.44, "profit": 688500 },
    "worst":  { "probability": 0.24, "profit": 380000 }
  },
  "expectedProfit": 672540,
  "csiAdjustedWeights": { "best": 0.32, "normal": 0.44, "worst": 0.24 },
  "explanation": { ... }
}
```

### `POST /compute/trends/:setupId`
Runs trend analysis across ALL seasons for a setup.

```json
// Response
{
  "indicators": [
    {
      "indicator": "profit_CA",
      "classification": "Improving",
      "timeSeries": [
        { "season": 1, "value": 420000, "delta": null },
        { "season": 2, "value": 510000, "delta": 90000 },
        { "season": 3, "value": 688500, "delta": 178500 }
      ],
      "trendMagnitude": 134250,
      "explanation": { ... }
    }
  ]
}
```

---

## 9. Notification Routes

### `GET /notifications`
All notifications for the authenticated user. Query params: `?unread=true`, `?limit=20`.

### `PUT /notifications/:id/read`
Mark single notification as read.

### `PUT /notifications/read-all`
Mark all as read.

### `DELETE /notifications/:id`

---

## 10. Report Routes

### `GET /reports`
All reports for the authenticated user.

### `POST /reports`
Save report metadata after client-side PDF generation.
```json
{
  "setupId": "...",
  "seasonId": "...",
  "reportType": "seasonal_cba",
  "title": "Season A 2024 — CBA Report",
  "snapshot": {
    "profitCA": 688500,
    "profitCF": 542000,
    "adoptionCost": 0,
    "csi": 0.645,
    "ttp": 3,
    "cnb": 42000
  },
  "language": "en"
}
```

### `GET /reports/:id`
### `DELETE /reports/:id`

---

## 11. Sync Routes

### `POST /sync/batch`
Processes an array of offline-queued records.

**Request**
```json
{
  "batchId": "uuid-v4",
  "records": [
    {
      "localId": "idb-abc-123",
      "endpoint": "/plots",
      "method": "POST",
      "body": { "treatment": "CA", "seasonId": "...", ... },
      "timestamp": "2024-05-10T08:23:00Z"
    }
  ]
}
```

**Response**
```json
{
  "batchId": "uuid-v4",
  "success": [
    { "localId": "idb-abc-123", "serverId": "mongo-ObjectId" }
  ],
  "failed": [
    { "localId": "idb-def-456", "error": "Duplicate entry for this plot/treatment" }
  ],
  "conflicts": []
}
```

Conflict resolution: server compares `timestamp` in request body with `updatedAt` of existing document. If server document is newer → `conflicts[]` entry with server version returned. Client keeps server version.

---

## 12. Trial Routes (Research Mode)

All guarded by `modeGuard({ require: 'research' })`. See `docs/COMPUTATION_ENGINE.md` §11 for the formulas and `docs/DATABASE_SCHEMA.md` §11–§15 for the collection shapes.

### `GET /trials` — every trial the researcher owns, across setups
### `GET /seasons/:seasonId/trials`
### `POST /seasons/:seasonId/trials`
Creates the Trial, its Treatment Register, and auto-generates the full t×b `trialPlots` grid.
```json
{
  "crop": "Beans",
  "numTreatments": 3,
  "numReplicates": 4,
  "plotSizeM2": 25,
  "rowSpacing": { "interRowCm": 50, "intraRowCm": 20 },
  "seedsPerHill": 2,
  "marketPriceRwfPerKg": 500,
  "wageRatePerDayRwf": 3000,
  "significanceLevel": 0.05,
  "treatments": [
    { "code": "T1", "label": "Conservation Agriculture", "description": "..." },
    { "code": "T2", "label": "Conventional Farming" },
    { "code": "T3", "label": "CA + Compost" }
  ]
}
```
**Response**: `201 Created` with `{ trial, treatments, plots }`.

### `GET /trials/:id` / `PUT /trials/:id` / `DELETE /trials/:id`
`PUT` accepts config edits; changing `numReplicates` upward auto-creates the
missing plots for every existing treatment (additive only — never deletes a
plot automatically). `numTreatments` cannot be set directly — it's derived
from the Treatment Register (see below).

### Treatment Register
- `GET /trials/:trialId/treatments`
- `POST /trials/:trialId/treatments` — adds a treatment, its b replicate plots, and bumps `Trial.numTreatments`.
- `PUT /treatments/:id` / `DELETE /treatments/:id` — delete cascades the treatment's plots and their cost/labour/yield rows, decrements `numTreatments`.

### Trial Plots
- `GET /trial-plots/:id` — plot + cost breakdown + yield + roll-up (§11.2)
- `PUT /trial-plots/:id` — override `plotSizeM2`

### Input Costs / Labour Costs
- `GET/POST /trial-plots/:trialPlotId/input-costs`, `PUT/DELETE /trial-input-costs/:id`
- `GET/POST /trial-plots/:trialPlotId/labour-costs`, `PUT/DELETE /trial-labour-costs/:id`

`costType` (`C_SD`/`C_SI`) is **required on every row** — the recorder tags it, it is never auto-classified:
```json
{
  "date": "2026-03-05",
  "inputItem": "Mulch",
  "costType": "C_SD",
  "quantity": 10,
  "unit": "bunches",
  "unitCostRwf": 200
}
```

### Yield & Revenue
- `GET /trial-plots/:trialPlotId/yield`
- `PUT /trial-plots/:trialPlotId/yield` — upsert, one entry per plot: `{ "yieldKg": 128, "priceRwfPerKg": 500 }`

### Analysis
### `GET /trials/:trialId/analysis`
Always computed live (never cached). Returns config, per-plot roll-ups,
descriptive stats, CBA summary, cost structure, RCBD ANOVA (+ pooled t-test
when exactly 2 treatments), risk/stability, break-even, and default-shock
sensitivity — see `docs/COMPUTATION_ENGINE.md` §11 for each field's formula.

### `POST /trials/:trialId/sensitivity`
Body: `{ "pessimistic": { "priceShockPct": -30, "wageShockPct": 30 }, ... }` — overrides the ±20% defaults for any subset of scenarios.

### `POST /trials/:trialId/partial-budget`
Body: `{ "baselineTreatmentId": "...", "alternativeTreatmentId": "..." }`

---

## Error Response Format

All errors follow:
```json
{
  "error": {
    "code": "MISSING_YIELD_DATA",
    "message": "Yield data is required to compute profit. Please enter observed yield before running CBA.",
    "field": "yield.value"
  }
}
```

**Standard HTTP codes:**
- `400` Bad Request (validation failure)
- `401` Unauthorized (missing/invalid JWT)
- `403` Forbidden (wrong role or mode)
- `404` Not Found
- `409` Conflict (duplicate unique field)
- `422` Unprocessable Entity (computation precondition failed)
- `500` Internal Server Error

---

## Rate Limiting

```
Global:  200 requests / 15 minutes per IP
Compute: 30 requests / 15 minutes per user (compute/* routes)
Sync:    10 batch requests / 15 minutes per user
```
