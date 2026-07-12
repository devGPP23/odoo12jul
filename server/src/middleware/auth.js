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
const { prisma } = require('../config/postgres');
const AppError = require('../utils/AppError');

/**
 * Middleware: requires a valid JWT. Attaches req.user.
 */
async function authenticate(req, res, next) {
  try {
    // 1. Extract token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication required. Provide a Bearer token.', 401);
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new AppError('Authentication required. Token is empty.', 401);
    }

    // 2. Check if token is blacklisted (logged out)
    const redis = getRedisClient();
    if (redis) {
      const isBlacklisted = await redis.get(`blacklist:${token}`);
      if (isBlacklisted) {
        throw new AppError('Token has been revoked. Please log in again.', 401);
      }
    }

    // 3. Verify JWT
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new AppError('Token has expired. Please log in again.', 401);
      }
      throw new AppError('Invalid token.', 401);
    }

    // 4. Fetch fresh user data (role might have changed since token was issued)
    const employee = await prisma.employee.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        departmentId: true,
      },
    });

    if (!employee) {
      throw new AppError('User no longer exists.', 401);
    }

    if (employee.status === 'INACTIVE') {
      throw new AppError('Account is deactivated. Contact your administrator.', 403);
    }

    // 5. Attach to request
    req.user = employee;
    req.token = token;

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Optional auth — attaches req.user if token is present, but doesn't fail if absent.
 */
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  return authenticate(req, res, next);
}

module.exports = { authenticate, optionalAuth };
