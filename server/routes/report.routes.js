const express = require('express');
const { body, param } = require('express-validator');
const auth = require('../middleware/auth');
const resolveUser = require('../middleware/resolveUser');
const validate = require('../middleware/validate');
const { listReports, createReport, getReport, deleteReport } = require('../controllers/report.controller');

const router = express.Router();

router.use(auth, resolveUser);

router.get('/reports', listReports);
router.post(
  '/reports',
  [
    body('reportType').isIn(['seasonal_cba', 'trend_analysis', 'statistical', 'full_season', 'comparative', 'research_analysis']),
    body('title').isString().trim().notEmpty(),
    body('trialId').optional().isMongoId(),
    body('language').optional().isIn(['en', 'rw'])
  ],
  validate,
  createReport
);
router.get('/reports/:id', [param('id').isMongoId()], validate, getReport);
router.delete('/reports/:id', [param('id').isMongoId()], validate, deleteReport);

module.exports = router;
