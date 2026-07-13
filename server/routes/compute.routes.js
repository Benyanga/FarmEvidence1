const express = require('express');
const { param } = require('express-validator');
const auth = require('../middleware/auth');
const resolveUser = require('../middleware/resolveUser');
const modeGuard = require('../middleware/modeGuard');
const validate = require('../middleware/validate');
const { computeLimiter } = require('../middleware/rateLimiters');
const { computeSeason, computeScenariosRoute, computeTrendsRoute } = require('../controllers/compute.controller');

const router = express.Router();

// Scoped per-route, not a blanket router.use() — this router is mounted
// broadly at '/api' alongside every other route module, and a path-less
// .use() here would run for ANY request that falls through every
// earlier-mounted router without a match (e.g. /charts/render), silently
// taxing unrelated endpoints against this strict 30-req/15min budget.
const computeGuard = [auth, resolveUser, computeLimiter];

// Farmer Mode only — Research Mode's computation lives under
// /trials/:trialId/analysis (see trial.routes.js).
router.post(
  '/compute/season/:seasonId',
  ...computeGuard,
  [param('seasonId').isMongoId()],
  validate,
  modeGuard({ from: 'season', param: 'seasonId', require: 'farmer' }),
  computeSeason
);

router.post('/compute/scenarios/:plotId', ...computeGuard, [param('plotId').isMongoId()], validate, computeScenariosRoute);

router.post('/compute/trends/:setupId', ...computeGuard, [param('setupId').isMongoId()], validate, computeTrendsRoute);

module.exports = router;
