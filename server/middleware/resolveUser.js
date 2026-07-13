const User = require('../models/User');

/**
 * Attaches req.dbUser (the local Mongo User document) based on req.user.clerkId
 * set by auth.js. Must run after auth.js. Used by controllers as the
 * authoritative ownerId for all owned resources.
 */
async function resolveUser(req, res, next) {
  try {
    const user = await User.findOne({ clerkId: req.user.clerkId });
    if (!user) {
      return res.status(401).json({
        error: { code: 'USER_NOT_SYNCED', message: 'Call POST /auth/sync-user before accessing this resource.' }
      });
    }
    req.dbUser = user;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = resolveUser;
