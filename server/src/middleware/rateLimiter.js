// Rate Limiter
// Spam aur DDoS rokne ke liye

const rateLimit = require('express-rate-limit');

// Normal API requests (100 per 15 min)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Bhai aaram se, 15 minute baad try karna.',
  },
});

// Auth endpoints ke liye strict limit (login spam rokne ke liye)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Bahut saare login attempts ho gaye, thodi der baad aana.',
  },
});

module.exports = { apiLimiter, authLimiter };
