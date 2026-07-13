/**
 * roleGuard(['researcher']) — restricts a route to specific roles.
 * Must run after auth.js.
 */
function roleGuard(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        error: { code: 'MISSING_TOKEN', message: 'Authentication required.' }
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: {
          code: 'ROLE_FORBIDDEN',
          message: `This action requires one of the following roles: ${allowedRoles.join(', ')}.`
        }
      });
    }

    next();
  };
}

module.exports = roleGuard;
