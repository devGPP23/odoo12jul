/**
 * JWT authentication middleware.
 * Extracts token from Authorization header, verifies it,
 * and attaches the decoded user to req.user.
 *
 * Session blacklist check is done via Redis for instant revocation.
 */

const jwt = require('jsonwebtoken');
const config = require('../config');
const { getRedisClient } = require('../config/redis');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// Token verify karna aur Redis me check karna
const authenticate = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Unauthorized: Token kahan hai bhai?', 401));
  }

  const token = authHeader.split(' ')[1];

  try {
    // Token signature aur expiry verify kar lo
    const decoded = jwt.verify(token, config.jwtSecret);

    // Redis me check karo ki ye user logout toh nahi kar chuka (blacklist)
    const redis = getRedisClient();
    if (redis) {
      const isBlacklisted = await redis.get(`blacklist:${token}`);
      if (isBlacklisted) {
        return next(new AppError('Unauthorized: Ye token logout ho chuka hai, naya le aao.', 401));
      }
    }

    // Aage access dedo
    req.user = decoded;
    req.token = token; // logout ke time use hoga shayad
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Unauthorized: Token expire ho gaya bhai', 401));
    }
    return next(new AppError('Unauthorized: Galat token hai', 401));
  }
});

// Ye check karta hai ki user khudka hi data access kar raha hai ya ADMIN hai
const requireSelf = (req, res, next) => {
  const requestedId = req.params.id || req.body.userId;
  if (req.user.role !== 'ADMIN' && req.user.id !== requestedId) {
    return next(new AppError('Forbidden: Dusre ka data access mat kar bhai', 403));
  }
  next();
};

module.exports = { authenticate, requireSelf };
