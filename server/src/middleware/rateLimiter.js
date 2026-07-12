const rateLimit = require('express-rate-limit');

// Normal API requests
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 100, // limit each ip to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Bhai aaram se, 15 minute baad try karna (Too many requests).'
  }
});

// Auth endpoints ke liye strict limit (login spam rokne ke liye)
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 failed attempts allowed
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Bahut saare login attempts ho gaye, ek ghante baad aana.'
  }
});

module.exports = {
  apiLimiter,
  authLimiter
};
