const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { syncUser, updatePreferences, setRole } = require('../controllers/auth.controller');

const router = express.Router();

router.post(
  '/auth/sync-user',
  auth,
  [body('displayName').optional().isString().trim()],
  validate,
  syncUser
);

router.post(
  '/auth/set-role',
  auth,
  [body('role').isIn(['farmer', 'researcher'])],
  validate,
  setRole
);

router.put(
  '/users/me',
  auth,
  [body('preferredLanguage').isIn(['en', 'rw'])],
  validate,
  updatePreferences
);

module.exports = router;
