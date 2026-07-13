const express = require('express');
const { body, param } = require('express-validator');
const auth = require('../middleware/auth');
const resolveUser = require('../middleware/resolveUser');
const validate = require('../middleware/validate');
const {
  listCosts,
  createCost,
  updateCost,
  deleteCost,
  listLabor,
  createLabor,
  updateLabor,
  deleteLabor
} = require('../controllers/cost.controller');

const router = express.Router();

router.use(auth, resolveUser);

// Input Costs
router.get('/plots/:plotId/costs', [param('plotId').isMongoId()], validate, listCosts);
router.post(
  '/plots/:plotId/costs',
  [
    param('plotId').isMongoId(),
    body('date').isISO8601(),
    body('inputName').isString().trim().notEmpty(),
    body('unit').isIn(['kg', 'L', 'bunches']),
    body('unitCost').isFloat({ min: 0 }),
    body('quantity').isFloat({ min: 0 })
  ],
  validate,
  createCost
);
router.put('/costs/:id', [param('id').isMongoId()], validate, updateCost);
router.delete('/costs/:id', [param('id').isMongoId()], validate, deleteCost);

// Labour Costs
router.get('/plots/:plotId/labor', [param('plotId').isMongoId()], validate, listLabor);
router.post(
  '/plots/:plotId/labor',
  [
    param('plotId').isMongoId(),
    body('date').isISO8601(),
    body('activity').isString().trim().notEmpty(),
    body('timeTaken').isFloat({ min: 0 }),
    body('unit').isIn(['days', 'hours', 'minutes']),
    body('wageRatePerDay').optional().isFloat({ min: 0 }),
    body('workingHoursPerDay').optional().isFloat({ min: 1 })
  ],
  validate,
  createLabor
);
router.put('/labor/:id', [param('id').isMongoId()], validate, updateLabor);
router.delete('/labor/:id', [param('id').isMongoId()], validate, deleteLabor);

module.exports = router;
