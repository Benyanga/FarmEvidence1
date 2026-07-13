const express = require('express');
const { body, param } = require('express-validator');
const auth = require('../middleware/auth');
const resolveUser = require('../middleware/resolveUser');
const validate = require('../middleware/validate');
const { listPlots, createPlot, getPlot, updatePlot, deletePlot } = require('../controllers/plot.controller');

const router = express.Router();

router.use(auth, resolveUser);

router.get('/seasons/:seasonId/plots', [param('seasonId').isMongoId()], validate, listPlots);

router.post(
  '/seasons/:seasonId/plots',
  [
    param('seasonId').isMongoId(),
    body('replicationNumber').optional().isInt({ min: 1, max: 5 }),
    body('plotArea').isFloat({ gt: 0 }),
    body('yield.value').optional().isFloat({ min: 0 }),
    body('sellingPrice.value').optional().isFloat({ min: 0 })
  ],
  validate,
  createPlot
);

router.get('/plots/:id', [param('id').isMongoId()], validate, getPlot);
router.put('/plots/:id', [param('id').isMongoId()], validate, updatePlot);
router.delete('/plots/:id', [param('id').isMongoId()], validate, deletePlot);

module.exports = router;
