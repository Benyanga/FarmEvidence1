const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const resolveUser = require('../middleware/resolveUser');
const validate = require('../middleware/validate');
const { syncLimiter } = require('../middleware/rateLimiters');
const { syncBatch } = require('../controllers/sync.controller');

const router = express.Router();

router.post(
  '/sync/batch',
  auth,
  resolveUser,
  syncLimiter,
  [body('records').isArray()],
  validate,
  syncBatch
);

module.exports = router;
