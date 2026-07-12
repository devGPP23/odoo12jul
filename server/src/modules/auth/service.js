/**
 * Auth Module — Service Layer.
 * Handles signup (employee-only), login, token management.
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const { prisma } = require('../../config/postgres');
const { getRedisClient } = require('../../config/redis');
const AppError = require('../../utils/AppError');

const SALT_ROUNDS = 12;

/**
 * Sign up a new employee account.
 * Role is ALWAYS hardcoded to EMPLOYEE — the payload's role field is stripped.
 */
async function signup({ name, email, password, departmentId }) {
  // Check if email already exists
  const existing = await prisma.employee.findUnique({ where: { email } });
  if (existing) {
    throw new AppError('An account with this email already exists.', 409);
  }

  // Validate department if provided
  if (departmentId) {
    const dept = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!dept || dept.status === 'INACTIVE') {
      throw new AppError('Invalid or inactive department.', 400);
    }
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const employee = await prisma.employee.create({
    data: {
      name,
      email,
      passwordHash,
      departmentId: departmentId || null,
      role: 'EMPLOYEE', // HARDCODED — no role selection at signup
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      departmentId: true,
      status: true,
      createdAt: true,
    },
  });

  const token = generateToken(employee);

  return { employee, token };
}

/**
 * Log in with email and password.
 */
async function login({ email, password }) {
  const employee = await prisma.employee.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      passwordHash: true,
      role: true,
      departmentId: true,
      status: true,
    },
  });

  if (!employee) {
    throw new AppError('Invalid email or password.', 401);
  }

  if (employee.status === 'INACTIVE') {
    throw new AppError('Account is deactivated. Contact your administrator.', 403);
  }

  const isMatch = await bcrypt.compare(password, employee.passwordHash);
  if (!isMatch) {
    throw new AppError('Invalid email or password.', 401);
  }

  const token = generateToken(employee);

  // Strip password hash from response
  const { passwordHash: _, ...safeEmployee } = employee;

  return { employee: safeEmployee, token };
}

/**
 * Get current user profile from token.
 */
async function getMe(userId) {
  const employee = await prisma.employee.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      departmentId: true,
      status: true,
      department: {
        select: { id: true, name: true },
      },
      createdAt: true,
    },
  });

  if (!employee) {
    throw new AppError('User not found.', 404);
  }

  return employee;
}

/**
 * Log out — blacklist the current token in Redis.
 */
async function logout(token) {
  try {
    const decoded = jwt.decode(token);
    if (decoded && decoded.exp) {
      const redis = getRedisClient();
      if (redis) {
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          await redis.set(`blacklist:${token}`, '1', 'EX', ttl);
        }
      }
    }
  } catch (err) {
    // Non-critical — token will expire naturally
    console.error('⚠️  Token blacklist failed:', err.message);
  }
}

/**
 * Forgot password — generate a reset token stored in Redis with TTL.
 */
async function forgotPassword(email) {
  const employee = await prisma.employee.findUnique({ where: { email } });
  if (!employee) {
    // Don't reveal whether the email exists
    return { message: 'If that email exists, a reset link has been sent.' };
  }

  const resetToken = jwt.sign({ id: employee.id, type: 'reset' }, config.jwtSecret, {
    expiresIn: '30m',
  });

  const redis = getRedisClient();
  if (redis) {
    await redis.set(`pwreset:${resetToken}`, employee.id, 'EX', 1800); // 30 min
  }

  // In production, send email here. For hackathon, return the token.
  return {
    message: 'If that email exists, a reset link has been sent.',
    ...(config.isDev && { resetToken }), // Only exposed in dev
  };
}

/**
 * Reset password using a valid reset token.
 */
async function resetPassword(resetToken, newPassword) {
  const redis = getRedisClient();
  let userId;

  if (redis) {
    userId = await redis.get(`pwreset:${resetToken}`);
  }

  if (!userId) {
    throw new AppError('Invalid or expired reset token.', 400);
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.employee.update({
    where: { id: userId },
    data: { passwordHash },
  });

  // Invalidate the reset token
  if (redis) {
    await redis.del(`pwreset:${resetToken}`);
  }

  return { message: 'Password reset successfully.' };
}

// ── Helpers ──────────────────────────────────────────────────

function generateToken(employee) {
  return jwt.sign(
    { id: employee.id, role: employee.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

module.exports = {
  signup,
  login,
  getMe,
  logout,
  forgotPassword,
  resetPassword,
};
