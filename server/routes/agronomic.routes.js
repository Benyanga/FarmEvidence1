const express = require('express');
const { param } = require('express-validator');
const auth = require('../middleware/auth');
const resolveUser = require('../middleware/resolveUser');
const validate = require('../middleware/validate');
const { getAgronomic, upsertAgronomic, updateAgronomic } = require('../controllers/agronomic.controller');

const router = express.Router();

router.use(auth, resolveUser);

router.get('/plots/:plotId/agronomic', [param('plotId').isMongoId()], validate, getAgronomic);
router.post('/plots/:plotId/agronomic', [param('plotId').isMongoId()], validate, upsertAgronomic);
router.put('/agronomic/:id', [param('id').isMongoId()], validate, updateAgronomic);

module.exports = router;
