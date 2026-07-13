const express = require('express');
const { body, param } = require('express-validator');
const auth = require('../middleware/auth');
const resolveUser = require('../middleware/resolveUser');
const validate = require('../middleware/validate');
const modeGuard = require('../middleware/modeGuard');
const {
  listSeasons,
  listAllSeasons,
  createSeason,
  getOrCreateSeason,
  getSeason,
  updateSeason,
  deleteSeason
} = require('../controllers/season.controller');
const { getFarmerDashboard } = require('../controllers/farmerDashboard.controller');

const router = express.Router();

router.use(auth, resolveUser);

router.get('/seasons', listAllSeasons);

router.get('/setups/:setupId/seasons', [param('setupId').isMongoId()], validate, listSeasons);

router.post(
  '/setups/:setupId/seasons',
  [
    param('setupId').isMongoId(),
    body('seasonNumber').isInt({ min: 1 }),
    body('seasonCode').optional().isIn(['A', 'B', 'C']),
    body('farmingSystem').optional().isIn(['CA', 'CF']),
    body('cropType').optional().isString().trim().notEmpty(),
    body('rowSpacing.intraRow').optional().isFloat({ gt: 0 }),
    body('rowSpacing.interRow').optional().isFloat({ gt: 0 }),
    body('seedsPerHill').optional().isInt({ gt: 0 }),
    body('csiDrivers.j1_marketAccess').optional().isFloat({ min: 0, max: 1 }),
    body('csiDrivers.j2_climateReliability').optional().isFloat({ min: 0, max: 1 }),
    body('csiDrivers.j3_soilQuality').optional().isFloat({ min: 0, max: 1 }),
    body('csiDrivers.j4_inputAvailability').optional().isFloat({ min: 0, max: 1 }),
    body('csiDrivers.j5_laborAvailability').optional().isFloat({ min: 0, max: 1 }),
    body('csiDrivers.j6_institutionalSupport').optional().isFloat({ min: 0, max: 1 })
  ],
  validate,
  createSeason
);

router.post(
  '/setups/:setupId/seasons/get-or-create',
  [param('setupId').isMongoId(), body('year').isInt({ min: 2000 }), body('seasonCode').isIn(['A', 'B', 'C'])],
  validate,
  getOrCreateSeason
);

router.get(
  '/seasons/:id/dashboard',
  [param('id').isMongoId()],
  validate,
  modeGuard({ from: 'season', param: 'id', require: 'farmer' }),
  getFarmerDashboard
);
router.get('/seasons/:id', [param('id').isMongoId()], validate, getSeason);
router.put('/seasons/:id', [param('id').isMongoId()], validate, updateSeason);
router.delete('/seasons/:id', [param('id').isMongoId()], validate, deleteSeason);

module.exports = router;
