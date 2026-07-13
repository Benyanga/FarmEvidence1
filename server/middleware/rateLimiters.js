const rateLimit = require('express-rate-limit');

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 200 : 5000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } }
});

const computeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.clerkId || req.ip,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many computation requests. Please try again later.' } }
});

const syncLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.clerkId || req.ip,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many sync requests. Please try again later.' } }
});

module.exports = { globalLimiter, computeLimiter, syncLimiter };
