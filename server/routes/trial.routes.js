const express = require('express');
const { body, param } = require('express-validator');
const auth = require('../middleware/auth');
const resolveUser = require('../middleware/resolveUser');
const validate = require('../middleware/validate');
const modeGuard = require('../middleware/modeGuard');
const {
  listTrials,
  listAllTrials,
  createTrial,
  getTrial,
  updateTrial,
  deleteTrial,
  listTreatments,
  createTreatment,
  updateTreatment,
  deleteTreatment
} = require('../controllers/trial.controller');
const {
  getTrialPlot,
  updateTrialPlot,
  listInputCosts,
  createInputCost,
  updateInputCost,
  deleteInputCost,
  listLabourCosts,
  createLabourCost,
  updateLabourCost,
  deleteLabourCost,
  getYield,
  upsertYield
} = require('../controllers/trialPlot.controller');
const { getTrialAnalysis, postTrialSensitivity, postTrialPartialBudget } = require('../controllers/trialAnalysis.controller');
const { getTrialDashboard } = require('../controllers/trialDashboard.controller');

const router = express.Router();

router.use(auth, resolveUser);

router.get('/trials', listAllTrials);

router.get(
  '/seasons/:seasonId/trials',
  [param('seasonId').isMongoId()],
  validate,
  modeGuard({ from: 'season', param: 'seasonId', require: 'research' }),
  listTrials
);

router.post(
  '/seasons/:seasonId/trials',
  [
    param('seasonId').isMongoId(),
    body('crop').isString().trim().notEmpty(),
    body('numTreatments').isInt({ min: 2 }),
    body('numReplicates').isInt({ min: 2, max: 10 }),
    body('plotSizeM2').isFloat({ gt: 0 }),
    body('treatments').isArray({ min: 2 }),
    body('treatments.*.code').isString().trim().notEmpty(),
    body('treatments.*.label').isString().trim().notEmpty(),
    body('design').optional().isIn(['RCBD', 'CRD', 'split-plot']),
    body('rowSpacing.interRowCm').optional().isFloat({ gt: 0 }),
    body('rowSpacing.intraRowCm').optional().isFloat({ gt: 0 }),
    body('seedsPerHill').optional().isInt({ gt: 0 }),
    body('marketPriceRwfPerKg').optional().isFloat({ min: 0 }),
    body('wageRatePerDayRwf').optional().isFloat({ min: 0 }),
    body('workingHoursPerDay').optional().isFloat({ gt: 0 }),
    body('significanceLevel').optional().isFloat({ gt: 0, lt: 1 })
  ],
  validate,
  modeGuard({ from: 'season', param: 'seasonId', require: 'research' }),
  createTrial
);

router.get(
  '/trials/:id',
  [param('id').isMongoId()],
  validate,
  modeGuard({ from: 'trial', param: 'id', require: 'research' }),
  getTrial
);
router.put(
  '/trials/:id',
  [param('id').isMongoId()],
  validate,
  modeGuard({ from: 'trial', param: 'id', require: 'research' }),
  updateTrial
);
router.delete(
  '/trials/:id',
  [param('id').isMongoId()],
  validate,
  modeGuard({ from: 'trial', param: 'id', require: 'research' }),
  deleteTrial
);

// Treatment Register
router.get(
  '/trials/:trialId/treatments',
  [param('trialId').isMongoId()],
  validate,
  modeGuard({ from: 'trial', param: 'trialId', require: 'research' }),
  listTreatments
);
router.post(
  '/trials/:trialId/treatments',
  [
    param('trialId').isMongoId(),
    body('code').isString().trim().notEmpty(),
    body('label').isString().trim().notEmpty()
  ],
  validate,
  modeGuard({ from: 'trial', param: 'trialId', require: 'research' }),
  createTreatment
);
router.put('/treatments/:id', [param('id').isMongoId()], validate, updateTreatment);
router.delete('/treatments/:id', [param('id').isMongoId()], validate, deleteTreatment);

// Trial Plots
router.get(
  '/trial-plots/:id',
  [param('id').isMongoId()],
  validate,
  modeGuard({ from: 'trialPlot', param: 'id', require: 'research' }),
  getTrialPlot
);
router.put(
  '/trial-plots/:id',
  [param('id').isMongoId(), body('plotSizeM2').optional().isFloat({ gt: 0 })],
  validate,
  modeGuard({ from: 'trialPlot', param: 'id', require: 'research' }),
  updateTrialPlot
);

// Input Costs
router.get(
  '/trial-plots/:trialPlotId/input-costs',
  [param('trialPlotId').isMongoId()],
  validate,
  modeGuard({ from: 'trialPlot', param: 'trialPlotId', require: 'research' }),
  listInputCosts
);
router.post(
  '/trial-plots/:trialPlotId/input-costs',
  [
    param('trialPlotId').isMongoId(),
    body('date').isISO8601(),
    body('inputItem').isString().trim().notEmpty(),
    body('costType').isIn(['C_SD', 'C_SI']),
    body('quantity').isFloat({ min: 0 }),
    body('unit').isString().trim().notEmpty(),
    body('unitCostRwf').isFloat({ min: 0 })
  ],
  validate,
  modeGuard({ from: 'trialPlot', param: 'trialPlotId', require: 'research' }),
  createInputCost
);
router.put('/trial-input-costs/:id', [param('id').isMongoId()], validate, updateInputCost);
router.delete('/trial-input-costs/:id', [param('id').isMongoId()], validate, deleteInputCost);

// Labour Costs
router.get(
  '/trial-plots/:trialPlotId/labour-costs',
  [param('trialPlotId').isMongoId()],
  validate,
  modeGuard({ from: 'trialPlot', param: 'trialPlotId', require: 'research' }),
  listLabourCosts
);
router.post(
  '/trial-plots/:trialPlotId/labour-costs',
  [
    param('trialPlotId').isMongoId(),
    body('date').isISO8601(),
    body('practice').isString().trim().notEmpty(),
    body('costType').isIn(['C_SD', 'C_SI']),
    body('numLabourers').isFloat({ min: 0 }),
    body('timeValue').isFloat({ min: 0 }),
    body('timeUnit').isIn(['min', 'hr', 'sec']),
    body('wageRatePerDayRwf').optional().isFloat({ min: 0 }),
    body('workingHoursPerDay').optional().isFloat({ gt: 0 })
  ],
  validate,
  modeGuard({ from: 'trialPlot', param: 'trialPlotId', require: 'research' }),
  createLabourCost
);
router.put('/trial-labour-costs/:id', [param('id').isMongoId()], validate, updateLabourCost);
router.delete('/trial-labour-costs/:id', [param('id').isMongoId()], validate, deleteLabourCost);

// Yield & Revenue (one per plot)
router.get(
  '/trial-plots/:trialPlotId/yield',
  [param('trialPlotId').isMongoId()],
  validate,
  modeGuard({ from: 'trialPlot', param: 'trialPlotId', require: 'research' }),
  getYield
);
router.put(
  '/trial-plots/:trialPlotId/yield',
  [
    param('trialPlotId').isMongoId(),
    body('yieldKg').isFloat({ min: 0 }),
    body('priceRwfPerKg').optional().isFloat({ min: 0 })
  ],
  validate,
  modeGuard({ from: 'trialPlot', param: 'trialPlotId', require: 'research' }),
  upsertYield
);

// Researcher Dashboard aggregate — always 200, shows partial-completion state.
router.get(
  '/trials/:trialId/dashboard',
  [param('trialId').isMongoId()],
  validate,
  modeGuard({ from: 'trial', param: 'trialId', require: 'research' }),
  getTrialDashboard
);

// Analysis (§6.1–§6.9) — always computed live, never cached.
router.get(
  '/trials/:trialId/analysis',
  [param('trialId').isMongoId()],
  validate,
  modeGuard({ from: 'trial', param: 'trialId', require: 'research' }),
  getTrialAnalysis
);
router.post(
  '/trials/:trialId/sensitivity',
  [param('trialId').isMongoId()],
  validate,
  modeGuard({ from: 'trial', param: 'trialId', require: 'research' }),
  postTrialSensitivity
);
router.post(
  '/trials/:trialId/partial-budget',
  [
    param('trialId').isMongoId(),
    body('baselineTreatmentId').isMongoId(),
    body('alternativeTreatmentId').isMongoId()
  ],
  validate,
  modeGuard({ from: 'trial', param: 'trialId', require: 'research' }),
  postTrialPartialBudget
);

module.exports = router;
