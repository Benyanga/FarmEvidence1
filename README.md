# FarmEvidence Platform

> MERN Stack | Offline-First PWA | Clerk Auth | Bootstrap UI | Bilingual (EN/RW)

FarmEvidence is a digital evidence collection and analysis platform for Conservation Agriculture (CA) trials in Rwanda. It supports three user roles — **Farmer**, **Researcher**, and **Extensionist** — with two computation modes (Farmer Mode / Research Mode) and full offline capability.

---

## Quick Links

| Document | Purpose |
|---|---|
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System architecture, layers, data flow |
| [DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md) | MongoDB collections & field specs |
| [COMPUTATION_ENGINE.md](./docs/COMPUTATION_ENGINE.md) | All formulas: CBA, CSI, Statistics, Scenarios |
| [API_SPEC.md](./docs/API_SPEC.md) | REST endpoints, auth, role guards |
| [DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Render & AWS deployment |
| [PROJECT_STRUCTURE.md](./docs/PROJECT_STRUCTURE.md) | Full directory layout |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Bootstrap 5, React-Bootstrap |
| Backend | Node.js 20, Express.js 4 |
| Database | MongoDB Atlas (Mongoose ODM) |
| Authentication | Clerk (JWT-based, role metadata) |
| Offline | Service Worker, IndexedDB (idb library), Workbox |
| PDF Reports | pdfmake (client-side) |
| Charts | Chart.js + react-chartjs-2 |
| i18n | react-i18next (EN + RW JSON files) |
| Deployment | Render (backend) or AWS (EC2 + ALB) |

---

## Role Matrix

| Feature | Farmer | Extensionist | Researcher |
|---|---|---|---|
| Data entry (plots) | ✓ | ✓ | ✓ |
| Trend analysis | ✓ | ✓ | ✓ |
| CBA (Farmer Mode) | ✓ | ✓ | — |
| CBA (Research Mode) | — | — | ✓ |
| RCBD design | — | — | ✓ |
| Statistical engine (t-test, ANOVA) | — | — | ✓ |
| Scenario engine | — | ✓ (view) | ✓ |
| Kinyarwanda UI | ✓ | — | — |
| PDF reports | ✓ | ✓ | ✓ |
| Manage FFS groups | — | ✓ | — |
| Export raw data | — | ✓ | ✓ |

---

## Environments

```
client/   → React PWA (served statically or via Vercel/Netlify)
server/   → Node/Express API (Render or AWS)
```

### Environment Variables

**`server/.env`**
```
PORT=5000
MONGODB_URI=mongodb+srv://<db-user>:<db-password>@<cluster-host>/farmevidence?appName=Cluster0
CLERK_SECRET_KEY=sk_test_<your-clerk-secret-key>
NODE_ENV=development
```

**`client/.env`**
```
REACT_APP_CLERK_PUBLISHABLE_KEY=pk_test_Y29tcG9zZWQta2luZ2Zpc2gtMTEuY2xlcmsuYWNjb3VudHMuZGV2JA
REACT_APP_API_BASE_URL=http://localhost:5000/api
```

> ⚠️ Never commit `.env` files. Both are in `.gitignore`.

---

## Getting Started (Development)

```bash
# 1. Clone and install
git clone <repo>
cd farmevidence

# 2. Install server deps
cd server && npm install

# 3. Install client deps
cd ../client && npm install

# 4. Run both (from root)
npm run dev   # uses concurrently
```

---

## Computation Modes

### Farmer Mode
- Simplified CBA: trend-only, no statistics
- AdoptionCost = max(0, Profit_prev − Profit_curr) — only on system change
- CSI computed but not displayed in full detail
- Kinyarwanda available

### Research Mode
- Full CBA with 3-tier cost structure (C_base, C_sys, C_time)
- RCBD design (2–5 replications, ≥2 treatments)
- Statistical engine: Welch's t-test (2), One-Way ANOVA + Tukey HSD (≥3)
- Effect sizes: Cohen's d, η²
- Scenario engine: Best/Normal/Worst × CSI-weighted probabilities
- AdoptionCost = max(0, Profit_CF(t) − Profit_CA(t)) — from observed data only
- TTP and CNB calculations
