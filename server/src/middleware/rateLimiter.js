/**
 * Rate Limiter Middleware.
 * Uses express-rate-limit to protect against brute-force and DDoS.
 */

const rateLimit = require('express-rate-limit');

// Standard API rate limiter (e.g., 100 requests per 15 minutes)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window`
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes.',
  },
});

// Stricter rate limiter for auth endpoints (e.g., login/signup)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Limit each IP to 10 auth requests per window
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
  },
});

module.exports = { apiLimiter, authLimiter };
