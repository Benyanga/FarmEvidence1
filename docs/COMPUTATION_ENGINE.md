# Computation Engine Reference — FarmEvidence Platform

All formulas are implemented as pure functions in `server/engines/`. No database calls inside engines. All inputs come from database records assembled by the controller before calling the engine.

**Farmer Mode and Research Mode run two independent computation pipelines** —
they no longer share a single `computeSeason` branch. Farmer Mode's pipeline
(§0 below, engines 1–4 Farmer-only parts, §8 explanations) is unchanged.
Research Mode's pipeline is §11 (`researchAnalysis.engine.js` +
`statistical.engine.js`), triggered per Trial via
`GET /trials/:trialId/analysis`, not per Season.

---

## 0. Computation Order — Farmer Mode (Per Season, Per Plot)

```
Step 1.  Collect cost entries (Input Costs + Labour Costs, tagged C_SD/C_SI by costClassifier.engine)
Step 2.  Collect labor records → labor.engine → C_labor
Step 3.  Assemble C_base
Step 4.  [Farmer Mode] CSI/phase/efficiency are not currently computed — C_sys and C_time are 0
Step 5.  Compute Revenue = Yield × SellingPrice (observed only, via the yield ledger)
Step 6.  Compute C_system = C_base + C_sys + C_time (= C_base today)
Step 7.  Compute Profit = Revenue − C_system
Step 8.  Compute AdoptionCost (empirically derived — NEVER manual; only on a system-change season)
Step 9.  Compute scenarios → scenario.engine
Step 10. Compute trends → trend.engine (needs prior season data)
Step 11. Generate explanations → explainability.engine
```

Research Mode has its own pipeline — see §11.

---

## 1. Labor Engine (`labor.engine.js`)

### Inputs
```
laborRecords: [
  { operation: 'landPrep' | 'planting' | 'weeding' | 'harvesting' | 'residueManagement',
    laborDays: Number,
    wageRate: Number }
]
```

### Formulas
```
C_labor_i = laborDays_i × wageRate_i        (per operation i)
C_labor   = Σ C_labor_i  (sum over all 5 operations)
```

### Output
```javascript
{
  breakdown: {
    landPrep: Number,
    planting: Number,
    weeding: Number,
    harvesting: Number,
    residueManagement: Number
  },
  total: Number    // C_labor
}
```

### Constraint
If aggregated labor entry exists in `costRecords` AND `laborRecords` also exist → reject with error "Disaggregated labor records exist; remove the aggregated 'labor' cost entry."

---

## 2. CSI Engine (`csi.engine.js`)

Farmer Mode data model only (`Season.csiDrivers`). Research Mode dropped the
CSI/phase/efficiency-adjusted cost model entirely in favor of the direct
treatment-mean CBA in §11 — there is no CSI concept in Research Mode.
`computeSeason` does not currently invoke this engine for Farmer Mode either
(C_sys/C_time are 0 in practice); the model fields remain available for a
future Farmer Mode enhancement.

### Inputs
```
drivers: {
  j1: Number ∈ [0,1],   // Market access
  j2: Number ∈ [0,1],   // Climate reliability
  j3: Number ∈ [0,1],   // Soil quality
  j4: Number ∈ [0,1],   // Input availability
  j5: Number ∈ [0,1],   // Labor availability
  j6: Number ∈ [0,1]    // Institutional support
}
```

### Formula
```
CSI(S) = 0.25×j1 + 0.20×j2 + 0.15×j3 + 0.15×j4 + 0.15×j5 + 0.10×j6

Weights sum: 0.25 + 0.20 + 0.15 + 0.15 + 0.15 + 0.10 = 1.00 ✓
Range: CSI ∈ [0, 1]
```

### Output
```javascript
{
  csi: Number,                // ∈ [0,1]
  driverContributions: {      // for explainability
    j1: Number, j2: Number, j3: Number,
    j4: Number, j5: Number, j6: Number
  },
  dominantDriver: String,     // driver with highest weight × score
  weakestDriver: String
}
```

---

## 3. Efficiency Engine (`efficiency.engine.js`)

Same status as §2 — retained for a future Farmer Mode enhancement, not used
by Research Mode.

### 3.1 Phase Assignment

```
currentSeasonOffset = seasonNumber - adoptionStartSeason + 1

if currentSeasonOffset ∈ [1, 6]  → phase = 'transition',    φ(t) = 0.30
if currentSeasonOffset ∈ [7, 12] → phase = 'stabilization', φ(t) = 0.70
if currentSeasonOffset ≥ 13      → phase = 'mature',        φ(t) = 1.00
if currentSeasonOffset < 1       → phase = 'pre-adoption',  φ(t) = 0.00
```

### 3.2 Efficiency Index

```
E_i(t, S) = E_max,i × φ(t) × CSI(S)
```

Where:
- `E_max,i` = maximum efficiency for treatment `i` (input, from setup or default)
- `φ(t)` = phase factor from step 3.1
- `CSI(S)` = context sensitivity index for season S

### 3.3 CA Cost Reduction

```
Q_CA,i(t) = Q_CF,i × [1 − E_i(t, S)]
```

Where:
- `Q_CF,i` = conventional farming cost for input category i
- `Q_CA,i(t)` = CA system cost for same category (reduced by efficiency)

### Output
```javascript
{
  phase: 'transition' | 'stabilization' | 'mature',
  phi: 0.30 | 0.70 | 1.00,
  seasonOffset: Number,
  eMax: Number,
  eiTS: Number,         // E_i(t,S)
  qCAi: Number          // Q_CA,i(t)
}
```

---

## 4. CBA Engine (`cba.engine.js`)

### 4.1 Cost Tiers

```
C_base = Σ(system-driven variable costs) + C_labor
         [Tillage + Fertilizer + Pesticide + Irrigation + ResidueManagement + C_labor]
         EXCLUDES: transport, storage, taxes, fees (off-farm)

C_sys  = Σ Q_CA,i(t) adjustments from efficiency engine
         (difference between CF and CA costs driven by E_i(t,S))

C_time = time-indexed cost adjustments (phase-weighted overhead)
         C_time = C_base × φ(t) × (1 - CSI)
         [Higher in transition phase with low CSI; approaches 0 in mature phase with high CSI]

C_system = C_base + C_sys + C_time
```

### 4.2 Revenue

```
Revenue = Yield_observed × SellingPrice_observed

Rules:
- Yield MUST be observed field measurement — NEVER imputed or projected
- SellingPrice MUST be observed market price — NEVER estimated
- If either is missing → Revenue = null → Profit cannot be computed
```

### 4.3 Profit

```
Profit(t) = Revenue(t) − C_system(t)
```

### 4.4 Adoption Cost — Farmer Mode only

```
AdoptionCost(t) = max(0, Profit_prev − Profit_curr)

Triggered ONLY when the farming system changes (treatment switches)
NOT computed on every season — only on system change events
Profit_prev = profit of the last season before system change
Profit_curr = profit of the first season after system change
```

#### CRITICAL CONSTRAINTS
- AdoptionCost is NEVER manually entered by the user
- AdoptionCost is NEVER computed from exponential decay formulas
- AdoptionCost is NEVER a preset constant
- AdoptionCost is derived ONLY from observed Profit values

TTP (Time-to-Profit) and CNB (Cumulative Net Benefit) were previously a
Research Mode, CA-vs-CF-specific concept (`Profit_CA(t)` vs `Profit_CF(t)`
across seasons). They have been retired along with the CSI/phase/adoption-
cost model — Research Mode's trial is now a single-season comparative
experiment (see §11), not a multi-season adoption study. Farmer Mode never
had TTP/CNB.

### Output per plot/season (Farmer Mode)
```javascript
{
  cBase: Number,
  cSys: Number,
  cTime: Number,
  cSystem: Number,
  revenue: Number,
  profit: Number,
  adoptionCost: Number,
  canCompute: Boolean,     // false if yield or price missing
  missingData: [String]    // list of missing fields if canCompute = false
}
```

---

## 5. Statistical Engine (`statistical.engine.js`)

**Research Mode ONLY**, generic over **t treatments × b replicates/blocks**
(RCBD design) — no CA/CF assumption. Called from
`trialAnalysis.controller.js` (`GET /trials/:trialId/analysis`), not from a
`/compute/statistics` route.

### 5.1 Descriptive Statistics (`summarize`)

Per treatment, per response variable:
```
mean, SD, SE = SD/√n, 95% CI = mean ± t_(α/2, n−1)×SE, CV% = SD/mean × 100

CV% interpretation (RCBD context):
  CV% < 10  → excellent precision
  CV% < 20  → acceptable
  CV% ≥ 20  → high variability — flag for review
```

### 5.2 RCBD Two-Way ANOVA (`computeRCBDAnova`) — always run, any t ≥ 2

```
Grand Total, Grand Mean, CF = GrandTotal² / (t×b)
SS_Total      = Σx² − CF
SS_Treatment  = (Σ TreatmentTotal_i² / b) − CF
SS_Block      = (Σ BlockTotal_j² / t) − CF
SS_Error      = SS_Total − SS_Treatment − SS_Block

df_Treatment = t−1, df_Block = b−1, df_Error = (t−1)(b−1), df_Total = tb−1
MS_x = SS_x / df_x
F_Treatment = MS_Treatment / MS_Error, F_Block = MS_Block / MS_Error
p = F.DIST.RT(F, df_x, df_Error)

CV% = √MS_Error / GrandMean × 100
LSD(α) = T.INV.2T(α, df_Error) × √(2×MS_Error / b)
```

Treatment/block effects (`mean_i − GrandMean`) and an auto-generated
interpretation string are included in the output. When the treatment effect
is significant (p ≤ α), a compact-letter-display grouping
(`computeCompactLetterGroups`) is computed using LSD as the threshold — this
replaces the old fixed-to-2-treatments block analysis and works for any
number of treatments (for t > 2, group any pair whose means differ by more
than LSD; maximal cliques of "not different" treatments share a letter).

### 5.3 Pooled t-test (`computePooledTTest`) — t = 2 only, alongside the ANOVA

```
Pooled variance = [(b−1)×SD_A² + (b−1)×SD_B²] / (2b−2)
t = (mean_A − mean_B) / √(pooled_variance × 2/b)
df = 2b − 2
p = T.DIST.2T(|t|, df)
95% CI = MeanDiff ± T.INV.2T(α, df) × √(pooled_variance × 2/b)
```

> **Note on the F=t² equivalence:** this pooled-variance formula (independent
> samples, `df = 2b−2`) is the classic CRD two-sample t-test. It is only
> exactly equivalent to §5.2's RCBD F-test (`F = t²`) when block variance is
> negligible — a true RCBD-paired equivalence would use the differenced
> series (`df = b−1`) instead. Both tests are reported so the report can show
> the conventional t-test alongside the block-aware ANOVA; treat the two as
> complementary, not numerically identical, when block effects are present.

### 5.4 Yield/Revenue Stability — pairwise LSD (t = 2 only)

```
Pooled variance = [(n_A−1)SD_A² + (n_B−1)SD_B²] / (n_A+n_B−2)
LSD(α) = T.INV.2T(α, n_A+n_B−2) × √(pooled_variance × (1/n_A + 1/n_B))
More stable system = the one with the lower CV%
```
For t > 2, treatments are simply ranked by CV% (no single LSD threshold).

### Output
```javascript
// computeRCBDAnova
{
  canCompute: Boolean,
  grandMean: Number, grandTotal: Number,
  treatmentMeans: { [label]: Number }, blockMeans: [Number],
  treatmentEffects: { [label]: Number }, blockEffects: [{ block, effect }],
  treatment: { ss, df, ms, f, p, significant },
  block: { ss, df, ms, f, p, significant },
  error: { ss, df, ms }, total: { ss, df },
  cv: Number, lsd: Number,
  letterGroups: { [label]: 'a'|'b'|... } | null,
  interpretation: String
}

// computePooledTTest (t = 2 only)
{
  canCompute: Boolean, labels: [String, String],
  meanDiff: Number, pooledVariance: Number, tStat: Number, df: Number,
  pValue: Number, significant: Boolean, ci95: { lower, upper }, decision: String
}
```

---

## 6. Scenario Engine (`scenario.engine.js`)

### 6.1 Scenario Definitions

| Scenario | Yield adjustment | Price adjustment | Cost adjustment |
|---|---|---|---|
| Best | +15% | +10% | −10% |
| Normal | 0% | 0% | 0% |
| Worst | −20% | −15% | +15% |

These are the default adjustments. Users may override percentage adjustments per scenario.

### 6.2 CSI-Adjusted Probabilities

```
Raw probabilities: p_best = 0.25, p_normal = 0.50, p_worst = 0.25

CSI-adjusted:
  p_best_adj   = p_best   × (1 + CSI)   / normalizer
  p_normal_adj = p_normal                / normalizer
  p_worst_adj  = p_worst  × (1 + (1−CSI)) / normalizer

Where normalizer ensures Σ p = 1.00

High CSI (favorable context) → shifts weight toward best scenario
Low CSI (unfavorable context) → shifts weight toward worst scenario
```

### 6.3 Expected Profit

```
Profit(t, best)   = (Yield × 1.15) × (Price × 1.10) − (C_system × 0.90)
Profit(t, normal) = Yield × Price − C_system
Profit(t, worst)  = (Yield × 0.80) × (Price × 0.85) − (C_system × 1.15)

E[Profit(t)] = p_best_adj × Profit(t, best)
             + p_normal_adj × Profit(t, normal)
             + p_worst_adj × Profit(t, worst)
```

### Output
```javascript
{
  scenarios: {
    best:   { probability: Number, profit: Number },
    normal: { probability: Number, profit: Number },
    worst:  { probability: Number, profit: Number }
  },
  expectedProfit: Number,
  csiAdjustedWeights: { best: Number, normal: Number, worst: Number }
}
```

---

## 7. Trend Engine (`trend.engine.js`)

### 7.1 Delta Computation

```
Δ_X(t) = X(t) − X(t−1)    for any indicator X
```

### 7.2 Trend Classification

```
Requires minimum 2 data points. With < 2 data points → 'Insufficient'

For a series of Δ values over the available seasons:

Improving:  Δ > 0 consistently (≥70% of deltas positive)
Declining:  Δ < 0 consistently (≥70% of deltas negative)
Volatile:   alternating positive/negative (< 70% consistent direction)
Stable:     |Δ| < threshold (e.g., < 5% of mean value) consistently
Insufficient: fewer than 2 seasons with data
```

### 7.3 Tracked Indicators

Farmer Mode only — season-over-season trends key off `Season.farmingSystem`,
which Research Mode no longer sets (treatments live on Trial/Treatment
instead, see §11). Research Mode has no season-over-season trend view;
its trial is a single-season comparative analysis.

- `profit_CA`, `profit_CF`, `profit_CAplus`, `profit_CFplus`
- `yield_CA`, `yield_CF`
- `adoptionCost`
- `csi`
- `biomassYield`, `grainYield`, `soilOrganicCarbon`, `soilMoisture`
- `plantHeight`, `leafAreaIndex`, `erosionScore`

### Output
```javascript
{
  indicator: String,
  timeSeries: [{ season: Number, value: Number, delta: Number }],
  classification: 'Improving' | 'Declining' | 'Volatile' | 'Stable' | 'Insufficient',
  trend_magnitude: Number,   // average |Δ| per season
  recommendation: String
}
```

---

## 8. Explainability Engine (`explainability.engine.js`)

**Every** computed result must have a corresponding explanation. The engine generates structured text in 4 parts.

### Template Structure

```javascript
{
  what: String,          // "What does this result mean?"
  why: String,           // "Why is it this value?"
  how: String,           // "How was it computed?"
  recommendation: String // "What should be done next?"
}
```

### Examples

**Profit explanation:**
```javascript
{
  what: "The CA plot profit for Season 3 is RWF 245,000/ha.",
  why: "Revenue of RWF 380,000 exceeded system costs of RWF 135,000, driven by reduced tillage cost in the stabilization phase.",
  how: "Profit = Revenue (Yield × Price) − C_system (C_base + C_sys + C_time). Phase φ = 0.70 (stabilization). CSI = 0.72.",
  recommendation: "Continue current CA practices. Soil organic carbon data is missing — collect it this season to improve CSI j3 score."
}
```

**Adoption cost explanation (Farmer Mode):**
```javascript
{
  what: "Adoption cost this season is RWF 18,000/ha.",
  why: "Profit declined from RWF 263,000 to RWF 245,000 after the system change.",
  how: "AdoptionCost = max(0, Profit_prev − Profit_curr) = 18,000",
  recommendation: "Track profit each season to see if the gap continues to close."
}
```

**RCBD ANOVA interpretation (Research Mode — see §11):**
```
"Treatment effect: Significant (F=8.23, p=0.012). Block effect: Not significant
(F=1.4, p=0.31). RCBD did not effectively control for spatial variability.
CV = 9.8%, LSD(0.05) = 214.5."
```

### i18n
Explanations are generated in English on the server. The client translates them using `i18next` for Kinyarwanda (Farmer Mode). Template keys in `rw.json` mirror `en.json`.

---

## 9. Mode Enforcement Rules

Farmer Mode and Research Mode run entirely separate pipelines now (no shared
`isResearch` branching) — `modeGuard.js` enforces this at the route level on
every Trial/TrialPlot/cost/labour/yield/analysis endpoint and on
`/compute/season/:seasonId`.

| Engine / Computation | Farmer Mode | Research Mode |
|---|---|---|
| C_base | ✓ | ✓ (§11 per-plot roll-up) |
| C_sys, C_time (CSI/phase-adjusted) | dormant (always 0 today) | ✗ retired |
| CSI / Phase + φ(t) | dormant (model fields retained, not computed) | ✗ retired |
| AdoptionCost | ✓ (on system change only) | ✗ retired |
| TTP / CNB | ✗ (never had it) | ✗ retired |
| Trends (season-over-season) | ✓ | ✗ (single-season trial analysis instead) |
| Statistical engine (RCBD ANOVA, t-test) | ✗ | ✓ (§11, generic t treatments) |
| CBA summary / cost structure / risk / break-even / sensitivity / partial budget | ✗ | ✓ (§11) |
| Scenario engine (Best/Normal/Worst, CSI-weighted) | ✓ (basic) | ✗ (superseded by §11's own sensitivity module) |
| Explainability | ✓ | plain-language interpretation strings generated inline by §11 engines, not `explainability.engine.js` |
| Kinyarwanda | ✓ | ✗ |

---

## 10. Computation Validation Rules

### Farmer Mode (`/compute/season/:seasonId`)
```
1. Yield must be observed (isObserved === true) — no computation without yield
2. SellingPrice must exist — no revenue without price
3. At least one cost entry must exist — no CBA with zero costs
4. If labor disaggregation required: all 5 operations must be present
5. Trend engine: ≥ 2 seasons of data; gaps flagged, not interpolated
6. Adoption cost: only computed on the setup's adoptionStartSeason
```

### Research Mode (`/trials/:trialId/analysis`, see §11)
```
1. costType (C_SD/C_SI) is required on every Input/Labour cost row — recorder-supplied, never auto-classified
2. Every plot needs a Yield & Revenue entry and recorded costs before analysis runs
3. At least 2 treatments required
4. RCBD ANOVA: at least 2 treatments and 2 replicates/blocks
5. Pooled t-test and pairwise LSD stability comparison: only when exactly 2 treatments
```

Any failed validation → `{ canCompute: false, missingData: ['field1', 'field2'] }` (Farmer) or `422 INSUFFICIENT_DATA` (Research).

---

## 11. Research Mode — Trial Analysis Engine (`researchAnalysis.engine.js` + `statistical.engine.js`)

Generic t-treatments × b-replicates RCBD trial. Data model: `Trial` (config)
→ `Treatment` (register) → `TrialPlot` (one per treatment×replicate cell) →
`TrialInputCost` / `TrialLaborCost` (recorder-tagged `C_SD`/`C_SI`) /
`TrialYield` (one per plot). See `docs/DATABASE_SCHEMA.md` for the collection
shapes and `docs/API_SPEC.md` §Trial Routes for the endpoints.

### 11.1 Trial Config Derived Fields (`computeTrialConfigDerived`)
```
extrapolationFactor      = 10000 / plotSizeM2
plantingStationsPerPlot  = floor(plotSizeM2 / ((interRowCm/100) × (intraRowCm/100)))
cropPopulationPerPlot    = plantingStationsPerPlot × seedsPerHill
cropPopulationPerHa      = cropPopulationPerPlot × extrapolationFactor
dfError                  = numTreatments × (numReplicates − 1)
tCritical                = T.INV.2T(significanceLevel, dfError)
```
Recomputed and cached on `Trial.computed` every time the trial config is saved.

### 11.2 Per-Plot Roll-Up (`computePlotRollup`)
```
totalProductionCost = C_SD_total + C_SI_total  (from the plot's cost logs)
costPerM2  = totalProductionCost / plotSizeM2
costPerHa  = totalProductionCost / (plotSizeM2/10000)
netBenefit = grossRevenue − totalProductionCost
adjustedGrossMargin = grossRevenue − C_SD_total
BCR = grossRevenue / totalProductionCost
ROI = (netBenefit / totalProductionCost) × 100
costPerKg  = totalProductionCost / yieldKg
```

### 11.3 Treatment Aggregation (`aggregateTreatments`)
Mean/SD/SE/95% CI/CV per treatment for any variable (yield, gross revenue,
total cost, C_SD, C_SI, net benefit) — built on `statistical.engine.summarize`.

### 11.4 CBA Summary (`computeCBASummary`)
Per-treatment indicators computed from treatment means (not the mean of
per-plot ratios): avg gross revenue (plot + ha), avg total cost, net benefit,
avg C_SD/C_SI, adjusted gross margin, BCR, ROI, avg yield (plot + ha), cost/kg.
Plus plain-language winner sentences (`argmax`/`argmin` per metric).

### 11.5 Cost Structure (`computeCostStructure`)
Per-treatment component breakdown (by input item / labour practice name) and
a C_SD vs C_SI roll-up, each as amount + % of treatment total cost.

### 11.6 RCBD ANOVA + t-test — see §5.2–§5.4.

### 11.7 Yield/Revenue Stability & Risk (`computeYieldStabilityRisk`)
Per treatment: mean, SD, CV%, CV classification (Low/Moderate/High risk),
min/max/range/median, downside risk (min as % of mean), probability of
below-average yield. Pairwise "more stable" note (lower CV wins) when t = 2.

### 11.8 Break-Even (`computeBreakEven`)
```
breakEvenYield (plot, ha) = totalCost / marketPrice
yieldMarginOfSafety %     = (actualYield − breakEvenYield) / actualYield × 100
breakEvenPrice            = totalCost / actualYield
priceMarginOfSafety %     = (marketPrice − breakEvenPrice) / marketPrice × 100
safety classification     = Strong (>20%) | Moderate (>10%) | Weak
overallBest = treatment winning ≥ half of the safety metrics
```

### 11.9 Sensitivity (`computeSensitivity`)
Three scenarios (Pessimistic/Expected/Optimistic), default ±20% price/wage
shocks, editable via `POST /trials/:trialId/sensitivity`. Only the
labour-driven cost share (C_SD) scales with the wage shock; C_SI is held
constant:
```
newPrice = basePrice × (1 + priceShockPct/100)
newWage  = baseWage  × (1 + wageShockPct/100)
scenarioRevenue = yieldKg × newPrice
scenarioCost    = C_SI + C_SD × (newWage/baseWage)
scenarioGrossMargin/BCR/ROI/costPerKg from the above
```
Winner matrix per scenario + a ranking-stability sentence.

### 11.10 Partial Budget (`computePartialBudgetAnalysis`)
Baseline → alternative treatment switching analysis: additional yield
revenue, cost-component savings/increases, net change, and an
adopt/don't-adopt recommendation sentence. `POST /trials/:trialId/partial-budget`.

### Recompute rule
`GET /trials/:trialId/analysis` always recomputes live from current records —
nothing here is cached in the database, so there is no manual "run analysis"
step to remember.
