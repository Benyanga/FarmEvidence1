const { validationResult } = require('express-validator');

/**
 * Runs after an array of express-validator checks; short-circuits with a
 * 400 if any failed. Place at the end of a route's validator chain.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array()[0];
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: first.msg,
        field: first.path
      }
    });
  }
  next();
}

module.exports = validate;
