const rateLimit = require('express-rate-limit');

// simple rate limiter to prevent spam
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 100, // limit each ip to 100 requests per window
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.'
  }
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 failed attempts allowed
  message: {
    success: false,
    error: 'Too many login attempts. Please try again after an hour.'
  }
});

module.exports = {
  apiLimiter,
  authLimiter
};
