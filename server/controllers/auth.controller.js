const User = require('../models/User');
const { clerkClient } = require('../config/clerk');

async function syncUser(req, res, next) {
  try {
    const { clerkId, email, role, displayName: tokenDisplayName } = req.user;
    const { displayName } = req.body;

    if (!role) {
      return res.status(400).json({
        error: {
          code: 'MISSING_ROLE',
          message: 'No role found in Clerk publicMetadata. Complete role selection before continuing.'
        }
      });
    }

    const user = await User.findOneAndUpdate(
      { clerkId },
      {
        $set: {
          email,
          role,
          displayName: displayName || tokenDisplayName || undefined
        },
        $setOnInsert: { preferredLanguage: 'en' }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ user });
  } catch (err) {
    next(err);
  }
}

async function updatePreferences(req, res, next) {
  try {
    const { preferredLanguage } = req.body;
    const user = await User.findOneAndUpdate(
      { clerkId: req.user.clerkId },
      { $set: { preferredLanguage } },
      { new: true, runValidators: true }
    );
    if (!user) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found.' } });
    }
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

async function setRole(req, res, next) {
  try {
    const { role } = req.body;

    const clerkUser = await clerkClient.users.getUser(req.user.clerkId);
    if (clerkUser.publicMetadata?.role) {
      return res.status(403).json({
        error: { code: 'ROLE_ALREADY_SET', message: 'Role is set at registration and cannot be changed. Contact an administrator.' }
      });
    }

    await clerkClient.users.updateUserMetadata(req.user.clerkId, { publicMetadata: { role } });

    const user = await User.findOneAndUpdate(
      { clerkId: req.user.clerkId },
      { $set: { role, email: req.user.email }, $setOnInsert: { preferredLanguage: 'en' } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ user });
  } catch (err) {
    next(err);
  }
}

module.exports = { syncUser, updatePreferences, setRole };
