const Notification = require('../models/Notification');

async function listNotifications(req, res, next) {
  try {
    const filter = { userId: req.dbUser._id };
    if (req.query.unread === 'true') filter.read = false;

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);

    const notifications = await Notification.find(filter).sort({ createdAt: -1 }).limit(limit);
    const unreadCount = await Notification.countDocuments({ userId: req.dbUser._id, read: false });

    res.json({ notifications, unreadCount });
  } catch (err) {
    next(err);
  }
}

async function markRead(req, res, next) {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.dbUser._id },
      { $set: { read: true, readAt: new Date() } },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Notification not found.' } });
    }
    res.json({ notification });
  } catch (err) {
    next(err);
  }
}

async function markAllRead(req, res, next) {
  try {
    await Notification.updateMany(
      { userId: req.dbUser._id, read: false },
      { $set: { read: true, readAt: new Date() } }
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function deleteNotification(req, res, next) {
  try {
    const notification = await Notification.findOneAndDelete({ _id: req.params.id, userId: req.dbUser._id });
    if (!notification) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Notification not found.' } });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { listNotifications, markRead, markAllRead, deleteNotification };
