# System Architecture — FarmEvidence Platform

---

## 1. Architecture Overview

FarmEvidence follows a **three-tier MERN architecture** with an offline-first PWA client:

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│   React 18 PWA  ·  Bootstrap 5  ·  Service Worker  ·  IndexedDB │
└──────────────┬───────────────────────────────┬───────────────────┘
               │ HTTPS/REST (Axios + Clerk JWT) │
               │ ← offline queue (IndexedDB)   │
┌──────────────▼───────────────────────────────▼───────────────────┐
│                        SERVER LAYER                              │
│   Node.js 20  ·  Express 4  ·  Clerk Middleware  ·  Engines     │
└──────────────┬───────────────────────────────────────────────────┘
               │ Mongoose ODM
┌──────────────▼───────────────────────────────────────────────────┐
│                        DATA LAYER                                │
│               MongoDB Atlas (Cluster0, rwandan region)           │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Authentication Architecture

```
User opens app
      │
      ▼
Clerk <SignIn /> / <SignUp />
      │ user selects role (farmer / researcher / extensionist)
      │ role stored in Clerk publicMetadata.role
      ▼
Clerk issues JWT (session token)
      │
      ▼
React client attaches JWT to every API request
  via axios interceptor: Authorization: Bearer <token>
      │
      ▼
Express middleware (auth.js)
  → clerkClient.verifyToken(token)
  → attaches req.user = { clerkId, role, email }
      │
      ▼
POST /auth/sync-user  (on first login)
  → upserts User document in MongoDB
  → stores clerkId, role, displayName, email
```

**Role lock**: Role is set at registration via Clerk's `publicMetadata`. It is read-only from the user's perspective — only admin can change it via Clerk dashboard.

---

## 3. Data Flow Architecture

### Write Path (Online)
```
User submits form
  → offline.service.js
    → POST to API endpoint
    → on success: update React state + write confirmed record to IndexedDB
    → on failure: write pending record to IndexedDB sync queue
```

### Write Path (Offline)
```
User submits form
  → offline.service.js detects navigator.onLine === false
    → write pending record to IndexedDB sync queue
    → optimistic UI update (pending badge shown)
  
  [user comes online]
  → useSync hook fires
    → sync.service.js reads all pending records from IndexedDB
    → POST /sync/batch { records: [...] }
    → server processes each, returns { success: [], failed: [] }
    → confirmed records removed from IDB queue
    → failed records kept with error annotation
```

### Read Path
```
Component mounts
  → useEffect: GET from API endpoint
    → on success: update React state + cache in IndexedDB
    → on failure (offline): read from IndexedDB cache
```

**Conflict resolution**: Last-confirmed-entry wins. The server timestamp on the confirmed record is authoritative. Pending local records are always attempted but can be rejected if a newer confirmed version exists (server checks `updatedAt`).

---

## 4. Module Architecture

### 4.1 Backend Modules

```
server/
├── Authentication Module       → Clerk JWT verification, user sync
├── Setup Module                → Farm / FFS / Research trial CRUD
├── Season Module               → Season records, metadata
├── Plot Module                 → Plot/treatment/replication records
├── Cost Module                 → Variable cost entries (6 system-driven)
├── Labor Module                → Disaggregated labor (5 operations)
├── Agronomic Module            → 7-indicator records per plot/season
├── Computation Module          → Orchestrates engine calls
├── Notification Module         → Time-based + condition-based alerts
├── Report Module               → Report metadata persistence
└── Sync Module                 → Batch offline record processing
```

### 4.2 Computation Engines (server/engines/)

Each engine is a **pure function module** — no database calls, no side effects.
Farmer Mode and Research Mode run independent pipelines (§4.3) sharing only
the fully mode-agnostic pure functions in `cba.engine`.

| Engine | Mode | Inputs | Outputs |
|---|---|---|---|
| `cba.engine` | Farmer (adoption cost) + shared indicator functions | cost records, yield, price | C_base, C_sys, C_time, Profit, AdoptionCost (Farmer); BCR/ROI/break-even/partial-budget (shared, reused by Research) |
| `csi.engine` / `efficiency.engine` | Farmer (dormant — not currently invoked) | 6 driver scores, adoption_start_season | CSI ∈ [0,1], φ(t), E_i(t,S) |
| `statistical.engine` | Research | per-treatment value arrays (t treatments × b blocks) | RCBD two-way ANOVA (F/p/LSD/CV per §5), pooled t-test (t=2), 95% CI, compact-letter groups |
| `researchAnalysis.engine` | Research | trial config, per-plot cost/yield data | trial config derived fields, per-plot roll-up, treatment aggregation, CBA summary, cost structure, risk/stability, break-even, sensitivity, partial budget — see `COMPUTATION_ENGINE.md` §11 |
| `scenario.engine` | Farmer (basic) | Profit arrays per scenario, CSI | E[Profit(t)], scenario weights |
| `trend.engine` | Farmer | time-series of any indicator | Δ_X(t), trend label |
| `explainability.engine` | Farmer | any Farmer-Mode engine output | { what, why, how, recommendation } |
| `labor.engine` / `laborcost.engine` | Farmer | labor entries per operation | C_labor total, per-operation breakdown |
| `costClassifier.engine` | Farmer | input/activity name | auto-derived C_SD/C_SI (Research Mode tags cost rows manually instead — see §4.3) |

### 4.3 Computation Order

**Farmer Mode** (enforced per season, `POST /compute/season/:seasonId`):
```
1. Collect cost entries (Input Costs + Labour Costs, auto-tagged C_SD/C_SI)
2. Assemble C_base = Σ costs
3. C_sys / C_time are 0 (CSI/phase model not currently invoked for Farmer Mode)
4. Compute Revenue = Yield × SellingPrice (observed only, via the yield ledger)
5. Compute Profit = Revenue − C_system
6. Compute AdoptionCost empirically, only on the setup's adoptionStartSeason
7. Compute trends → trend.engine
8. Generate explanations → explainability.engine
```

**Research Mode** (computed live on every `GET /trials/:trialId/analysis` —
no manual "run compute" step, nothing cached):
```
1. Assemble each plot's per-plot roll-up from its recorder-tagged cost logs + yield entry
2. Aggregate to treatment-level means/SD/SE/CI/CV
3. Compute CBA summary, cost structure, RCBD ANOVA (+ t-test if 2 treatments)
4. Compute yield/revenue stability & risk, break-even, sensitivity, partial budget
```
See `COMPUTATION_ENGINE.md` §11 for full formulas.

---

## 5. Frontend Module Architecture

### 5.1 Role-Based Module Access

```
App.jsx (Router)
│
├── /auth/*                     → public (unauthenticated)
│
├── [authenticated]
│   ├── /dashboard              → role-specific dashboard
│   ├── /setup/*                → all roles
│   ├── /seasons/*              → all roles
│   ├── /plots/*                → all roles
│   ├── /costs/*                → all roles
│   ├── /agronomic/*            → all roles
│   ├── /trends/*               → all roles
│   ├── /reports/*              → all roles
│   ├── /notifications          → all roles
│   │
│   ├── [researcher only]
│   │   └── /trials/*           → Trial setup, Treatment Register, plot
│   │                             data entry, and analysis (CBA, RCBD ANOVA,
│   │                             risk, break-even, sensitivity, partial
│   │                             budget) — see API_SPEC.md §12.
│   │                             (Frontend screens pending a follow-up pass;
│   │                             backend API is live.)
│   │
│   └── [extensionist only]
│       ├── /ffs/*              → FFS group management
│       └── /scenarios/*        → scenario view (read-only parameters)
```

### 5.2 State Management

State is kept local to each page/component via React hooks. No global state manager (Redux/Zustand) is required because:
- Server is authoritative source of truth
- IndexedDB is the offline cache
- Role/mode are derived from Clerk JWT (stable for session)

Only `SyncContext` is global — it tracks the pending sync queue count for the `OfflineBanner` component.

---

## 6. Offline Architecture (PWA)

```
client/public/service-worker.js (Workbox)
│
├── Cache-first strategy for static assets (JS, CSS, images)
├── Network-first strategy for API calls
│   └── On network fail → return cached response from Cache API
│
└── Background Sync (not relied on for data integrity)
    └── Supplement only — primary sync via useSync hook
```

```
client/src/services/db.js (IndexedDB via idb)
│
├── Stores:
│   ├── setups          (cached server data)
│   ├── seasons         (cached server data)
│   ├── plots           (cached server data)
│   ├── costRecords     (cached server data)
│   ├── laborRecords    (cached server data)
│   ├── agronomicRecords(cached server data)
│   └── syncQueue       (pending writes)
│       └── { id, endpoint, method, body, timestamp, retries }
```

---

## 7. i18n Architecture

```
src/i18n/
├── index.js        → i18next.init({ lng: 'en', fallbackLng: 'en' })
├── en.json         → All English strings
└── rw.json         → All Kinyarwanda strings

Rules:
- Farmer mode: language toggle shows EN ↔ RW
- Researcher/Extensionist: EN only, toggle hidden
- NO string mixing within a single session
- All UI strings use t('key') — never hardcoded
```

---

## 8. Security Architecture

| Concern | Mitigation |
|---|---|
| API auth | Clerk JWT on every request; `auth.js` middleware rejects unsigned tokens |
| Role enforcement | `roleGuard.js` checks `req.user.role` on protected routes |
| Mode enforcement | `modeGuard.js` checks setup type before running Research-Mode engines |
| Secrets | `.env` files excluded from git via `.gitignore` |
| MongoDB injection | Mongoose schema validation + parameterized queries |
| CORS | `cors` package: allow only client origin in production |
| Rate limiting | `express-rate-limit` on all API routes |
| Input validation | `express-validator` on all incoming request bodies |

---

## 9. Deployment Architecture

```
Production:

Render (Web Service)              MongoDB Atlas
┌─────────────────────┐          ┌───────────────┐
│  Node/Express API   │◄────────►│  Cluster0     │
│  PORT: 10000        │          │  farmevidence │
└─────────────────────┘          └───────────────┘
         ▲
         │ HTTPS
         │
Render (Static Site) or Vercel
┌─────────────────────┐
│  React PWA (build/) │
│  Service Worker     │
└─────────────────────┘
         ▲
         │ HTTPS
         │
      End Users (mobile/desktop browsers)
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full setup instructions.

---

## 10. Notification Architecture

Two notification types:

**Time-based** (server-side, checked on login and via daily cron):
- Season start/end reminders
- Data entry deadlines

**Condition-based** (server-side, triggered after computation):
- Profit below threshold
- CSI driver score critically low (< 0.3)
- TTP milestone reached
- Trend worsening for ≥3 consecutive seasons
- Missing data required for computation

Notifications stored in `Notification` collection. Client polls on dashboard load and displays via `NotificationCenter`. Unread count shown in navbar badge.
