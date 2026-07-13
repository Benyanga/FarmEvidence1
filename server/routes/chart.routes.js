const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const resolveUser = require('../middleware/resolveUser');
const validate = require('../middleware/validate');
const { renderChartRoute } = require('../controllers/chart.controller');

const router = express.Router();

router.use(auth, resolveUser);

router.post(
  '/charts/render',
  [
    body('type').isIn(['bar', 'line', 'pie']),
    body('labels').isArray({ min: 1 }),
    body('series').isArray({ min: 1 })
  ],
  validate,
  renderChartRoute
);

module.exports = router;
