const express = require('express');
const { param } = require('express-validator');
const auth = require('../middleware/auth');
const resolveUser = require('../middleware/resolveUser');
const validate = require('../middleware/validate');
const {
  listNotifications,
  markRead,
  markAllRead,
  deleteNotification
} = require('../controllers/notification.controller');

const router = express.Router();

router.use(auth, resolveUser);

router.get('/notifications', listNotifications);
router.put('/notifications/read-all', markAllRead);
router.put('/notifications/:id/read', [param('id').isMongoId()], validate, markRead);
router.delete('/notifications/:id', [param('id').isMongoId()], validate, deleteNotification);

module.exports = router;
