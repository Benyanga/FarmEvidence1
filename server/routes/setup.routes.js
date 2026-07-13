const express = require('express');
const { body, param } = require('express-validator');
const auth = require('../middleware/auth');
const resolveUser = require('../middleware/resolveUser');
const validate = require('../middleware/validate');
const {
  listSetups,
  createSetup,
  getSetup,
  updateSetup,
  deleteSetup,
  addResearchYear
} = require('../controllers/setup.controller');

const router = express.Router();

router.use(auth, resolveUser);

router.get('/setups', listSetups);

router.post(
  '/setups',
  [
    body('name').isString().trim().notEmpty(),
    body('adoptionStartSeason').isInt({ min: 1 }),
    body('rcbd.numReplications').optional().isInt({ min: 2, max: 5 }),
    body('farmDimensions.length').optional().isFloat({ gt: 0 }),
    body('farmDimensions.width').optional().isFloat({ gt: 0 }),
    body('location.cell').optional().isString().trim()
  ],
  validate,
  createSetup
);

router.get('/setups/:id', [param('id').isMongoId()], validate, getSetup);
router.put('/setups/:id', [param('id').isMongoId()], validate, updateSetup);
router.delete('/setups/:id', [param('id').isMongoId()], validate, deleteSetup);

router.post(
  '/setups/:id/years',
  [param('id').isMongoId(), body('year').isInt({ min: 2000 })],
  validate,
  addResearchYear
);

module.exports = router;
