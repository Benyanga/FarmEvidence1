# Project Structure

```
farmevidence/
│
├── README.md
├── .gitignore
├── package.json                    # Root: concurrently for dev
│
├── docs/                           # Architecture documentation (this folder)
│   ├── PROJECT_STRUCTURE.md
│   ├── ARCHITECTURE.md
│   ├── DATABASE_SCHEMA.md
│   ├── COMPUTATION_ENGINE.md
│   ├── API_SPEC.md
│   └── DEPLOYMENT.md
│
├── server/                         # Node.js + Express backend
│   ├── .env                        # ← secrets, never commit
│   ├── .env.example
│   ├── package.json
│   ├── server.js                   # Entry point: Express + MongoDB connection
│   │
│   ├── config/
│   │   ├── db.js                   # Mongoose connect
│   │   └── clerk.js                # Clerk backend SDK init
│   │
│   ├── middleware/
│   │   ├── auth.js                 # Clerk JWT verification → req.user
│   │   ├── roleGuard.js            # Role-based access control
│   │   ├── modeGuard.js            # Farmer vs Research mode enforcement
│   │   └── errorHandler.js
│   │
│   ├── models/
│   │   ├── User.js                 # Clerk user sync + role + settings
│   │   ├── Setup.js                # Farm/FFS/Research trial setup
│   │   ├── Season.js               # Season record per setup
│   │   ├── Plot.js                 # Plot/replication record
│   │   ├── CostRecord.js           # Season-level cost entries
│   │   ├── LaborRecord.js          # Disaggregated labor by operation
│   │   ├── AgronomicRecord.js      # 7 agronomic indicators per plot/season
│   │   ├── Notification.js
│   │   ├── Report.js               # Report metadata (PDF stored client-side)
│   │   └── SyncLog.js              # Offline sync queue audit log
│   │
│   ├── routes/
│   │   ├── auth.routes.js          # POST /auth/sync-user
│   │   ├── setup.routes.js         # CRUD /setups
│   │   ├── season.routes.js        # CRUD /seasons
│   │   ├── plot.routes.js          # CRUD /plots
│   │   ├── cost.routes.js          # CRUD /costs, /labor
│   │   ├── agronomic.routes.js     # CRUD /agronomic
│   │   ├── compute.routes.js       # POST /compute/* (all engines)
│   │   ├── notification.routes.js
│   │   ├── report.routes.js
│   │   └── sync.routes.js          # POST /sync/batch (offline push)
│   │
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── setup.controller.js
│   │   ├── season.controller.js
│   │   ├── plot.controller.js
│   │   ├── cost.controller.js
│   │   ├── agronomic.controller.js
│   │   ├── compute.controller.js
│   │   ├── notification.controller.js
│   │   ├── report.controller.js
│   │   └── sync.controller.js
│   │
│   └── engines/                    # Pure computation modules (no DB access)
│       ├── cba.engine.js           # CBA: C_base, C_sys, C_time, Profit, AdoptionCost, TTP, CNB
│       ├── csi.engine.js           # CSI: 6-driver weighted average
│       ├── efficiency.engine.js    # Phase tracker + E_i(t,S) model
│       ├── statistical.engine.js   # t-test, ANOVA, Tukey HSD, Cohen's d, η², CI
│       ├── scenario.engine.js      # Best/Normal/Worst × CSI-weighted E[Profit]
│       ├── trend.engine.js         # Δ_X(t) classification
│       ├── explainability.engine.js # WHAT/WHY/HOW/REC for all outputs
│       └── labor.engine.js         # Labor disaggregation: LP, PL, WD, HV, RM
│
└── client/                         # React 18 PWA
    ├── .env                        # ← Clerk publishable key, never commit
    ├── .env.example
    ├── package.json
    ├── public/
    │   ├── index.html
    │   ├── manifest.json           # PWA manifest
    │   ├── service-worker.js       # Workbox-generated SW
    │   └── icons/                  # App icons (192, 512)
    │
    └── src/
        ├── index.js                # React root, ClerkProvider, i18n init
        ├── App.jsx                 # Router: public / protected routes
        │
        ├── i18n/
        │   ├── index.js            # react-i18next setup
        │   ├── en.json             # English strings
        │   └── rw.json             # Kinyarwanda strings
        │
        ├── hooks/
        │   ├── useRole.js          # Returns role from Clerk metadata
        │   ├── useMode.js          # Returns 'farmer' | 'research'
        │   ├── useOnline.js        # navigator.onLine + event listeners
        │   ├── useSync.js          # Triggers offline sync on reconnect
        │   └── useCompute.js       # API call wrapper for compute endpoints
        │
        ├── context/
        │   ├── RoleContext.jsx
        │   └── SyncContext.jsx     # Sync queue state
        │
        ├── services/
        │   ├── api.js              # Axios instance with Clerk JWT interceptor
        │   ├── db.js               # IndexedDB via idb: stores, CRUD helpers
        │   ├── sync.service.js     # Reads IndexedDB queue → POST /sync/batch
        │   └── offline.service.js  # Write-through: online → API + IDB; offline → IDB only
        │
        ├── pages/
        │   ├── auth/
        │   │   ├── SignIn.jsx       # Clerk <SignIn /> component
        │   │   ├── SignUp.jsx       # Clerk <SignUp /> + role selector
        │   │   └── RoleSelect.jsx  # Sets Clerk publicMetadata.role
        │   │
        │   ├── dashboard/
        │   │   ├── FarmerDashboard.jsx
        │   │   ├── ResearcherDashboard.jsx
        │   │   └── ExtensionistDashboard.jsx
        │   │
        │   ├── setup/
        │   │   ├── SetupList.jsx
        │   │   ├── SetupForm.jsx    # Farm / FFS / Research trial creation
        │   │   └── SetupDetail.jsx
        │   │
        │   ├── seasons/
        │   │   ├── SeasonList.jsx
        │   │   ├── SeasonForm.jsx
        │   │   └── SeasonDetail.jsx
        │   │
        │   ├── plots/
        │   │   ├── PlotList.jsx
        │   │   ├── PlotForm.jsx     # Treatment + replication entry
        │   │   └── PlotDetail.jsx
        │   │
        │   ├── costs/
        │   │   ├── CostEntry.jsx    # 6 system-driven variable costs
        │   │   ├── LaborEntry.jsx   # 5 disaggregated operations
        │   │   └── CostSummary.jsx
        │   │
        │   ├── agronomic/
        │   │   ├── AgronomicForm.jsx # 7 indicators
        │   │   └── AgronomicChart.jsx
        │   │
        │   ├── cba/
        │   │   ├── CBADashboard.jsx
        │   │   ├── CBAResults.jsx
        │   │   └── AdoptionCostView.jsx
        │   │
        │   ├── statistics/          # Research Mode only
        │   │   ├── RCBDDesign.jsx
        │   │   ├── StatResults.jsx
        │   │   └── EffectSize.jsx
        │   │
        │   ├── scenarios/
        │   │   ├── ScenarioInput.jsx
        │   │   └── ScenarioResults.jsx
        │   │
        │   ├── trends/
        │   │   ├── TrendChart.jsx
        │   │   └── TrendClassification.jsx
        │   │
        │   ├── reports/
        │   │   ├── ReportBuilder.jsx
        │   │   └── ReportPreview.jsx
        │   │
        │   └── notifications/
        │       └── NotificationCenter.jsx
        │
        ├── components/
        │   ├── layout/
        │   │   ├── Navbar.jsx        # Role-aware nav + language toggle
        │   │   ├── Sidebar.jsx
        │   │   └── OfflineBanner.jsx # Shows when offline + pending sync count
        │   │
        │   ├── common/
        │   │   ├── RoleGuard.jsx     # <RoleGuard roles={['researcher']}> wrapper
        │   │   ├── ModeGuard.jsx     # <ModeGuard mode="research"> wrapper
        │   │   ├── LoadingSpinner.jsx
        │   │   ├── ErrorAlert.jsx
        │   │   └── ConfirmModal.jsx
        │   │
        │   ├── explainability/
        │   │   └── ExplainPanel.jsx  # WHAT / WHY / HOW / RECOMMENDATION cards
        │   │
        │   └── charts/
        │       ├── ProfitChart.jsx
        │       ├── CostBreakdownChart.jsx
        │       ├── TrendChart.jsx
        │       └── ScenarioChart.jsx
        │
        └── utils/
            ├── formatters.js         # Currency, percentage, season labels
            ├── validators.js         # Form validation rules
            └── constants.js          # Treatment codes, phase thresholds, weights
```

---

## Key Architectural Decisions

### Monorepo Layout
Both `client/` and `server/` live in one repository. A root `package.json` uses `concurrently` to run both in development. In production they are deployed independently.

### Engine Separation
All computation logic lives in `server/engines/`. Controllers call engines and return results; engines never touch the database. This enables unit testing of every formula in isolation.

### Offline Write-Through
`offline.service.js` is the single gateway for all data writes. It attempts the API call first; on failure (offline) it writes to IndexedDB and appends a record to the sync queue. On reconnect, `sync.service.js` drains the queue via `POST /sync/batch`.

### Role in Clerk Metadata
User role (`farmer` | `researcher` | `extensionist`) is stored in Clerk `publicMetadata.role`. The backend reads it from the verified JWT; the frontend reads it via `useUser().publicMetadata.role`. Role is set once at registration and cannot be changed by the user.

### Mode Derivation
Mode is derived from the setup type, not stored explicitly:
- Setup type `farm` or `ffs` → Farmer Mode
- Setup type `research_trial` → Research Mode

The `modeGuard.js` middleware enforces this on all Research-Mode-only endpoints.
