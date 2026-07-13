const { verifyToken } = require('@clerk/backend');
const { clerkClient } = require('../config/clerk');

/**
 * Verifies the Clerk session JWT from the Authorization header and attaches
 * req.user = { clerkId, role, email } for downstream middleware/controllers.
 */
async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({
        error: { code: 'MISSING_TOKEN', message: 'Authorization token is required.' }
      });
    }

    const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
    const clerkUser = await clerkClient.users.getUser(payload.sub);

    req.user = {
      clerkId: clerkUser.id,
      email: clerkUser.emailAddresses?.[0]?.emailAddress || '',
      role: clerkUser.publicMetadata?.role || null,
      displayName: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim()
    };

    next();
  } catch (err) {
    return res.status(401).json({
      error: { code: 'INVALID_TOKEN', message: 'Invalid or expired session token.' }
    });
  }
}

module.exports = auth;
