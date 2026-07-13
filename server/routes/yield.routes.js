const express = require('express');
const { body, param } = require('express-validator');
const auth = require('../middleware/auth');
const resolveUser = require('../middleware/resolveUser');
const validate = require('../middleware/validate');
const { listYields, createYield, updateYield, deleteYield } = require('../controllers/yield.controller');

const router = express.Router();

router.use(auth, resolveUser);

router.get('/plots/:plotId/yields', [param('plotId').isMongoId()], validate, listYields);

router.post(
  '/plots/:plotId/yields',
  [
    param('plotId').isMongoId(),
    body('date').isISO8601(),
    body('yieldHarvested').optional().isFloat({ min: 0 }),
    body('yieldSold').optional().isFloat({ min: 0 }),
    body('marketPrice').optional().isFloat({ min: 0 })
  ],
  validate,
  createYield
);

router.put('/yields/:id', [param('id').isMongoId()], validate, updateYield);
router.delete('/yields/:id', [param('id').isMongoId()], validate, deleteYield);

module.exports = router;
