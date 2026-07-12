const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const config = require('../../config');
const AppError = require('../../utils/AppError');
const { getRedisClient } = require('../../config/redis');

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

class AuthService {
  async signup(data) {
    const { name, email, password } = data;

    // Check if user already exists
    const existingUser = await prisma.employee.findUnique({ where: { email } });
    if (existingUser) {
      throw new AppError('Email already registered', 409);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user (default role is EMPLOYEE)
    const user = await prisma.employee.create({
      data: {
        name,
        email,
        passwordHash,
        role: 'EMPLOYEE',
      },
    });

    // Generate tokens
    const tokens = this.generateTokens(user);
    
    // Store refresh token in redis if needed (optional for basic auth but good for robust sessions)
    return { user: this.sanitizeUser(user), ...tokens };
  }

  async login(email, password) {
    const user = await prisma.employee.findUnique({ where: { email } });
    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    if (user.status !== 'ACTIVE') {
      throw new AppError('Account is not active', 403);
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Invalid credentials', 401);
    }

    const tokens = this.generateTokens(user);

    // Save refresh token in Redis (valid for 7 days)
    const redis = getRedisClient();
    if (redis) {
      await redis.set(`refresh:${user.id}`, tokens.refreshToken, 'EX', 7 * 24 * 60 * 60);
    }

    return { user: this.sanitizeUser(user), ...tokens };
  }

  async forgotPassword(email) {
    const user = await prisma.employee.findUnique({ where: { email } });
    if (!user) {
      // Don't leak if user exists or not
      return { message: 'If email exists, a reset token was sent.' };
    }

    // Generate token
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // In a real app, hash this token before storing in DB. 
    // Here we use Redis with a 15-minute expiration
    const redis = getRedisClient();
    if (redis) {
      await redis.set(`reset_pw:${resetToken}`, user.id, 'EX', 15 * 60);
    }

    // Returning token in response for hackathon development
    return { 
      message: 'Password reset initiated', 
      resetToken 
    };
  }

  async resetPassword(token, newPassword) {
    const redis = getRedisClient();
    if (!redis) {
      throw new AppError('Redis not available', 500);
    }

    const userId = await redis.get(`reset_pw:${token}`);
    if (!userId) {
      throw new AppError('Invalid or expired reset token', 400);
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await prisma.employee.update({
      where: { id: userId },
      data: { passwordHash }
    });

    // Invalidate the token
    await redis.del(`reset_pw:${token}`);

    // Optionally revoke all active sessions for this user by revoking refresh token
    await redis.del(`refresh:${userId}`);

    return { message: 'Password reset successful' };
  }

  async refreshToken(token) {
    try {
      // Verify refresh token signature
      const decoded = jwt.verify(token, config.jwtSecret);
      
      const redis = getRedisClient();
      if (redis) {
        const storedToken = await redis.get(`refresh:${decoded.id}`);
        if (storedToken !== token) {
          throw new AppError('Invalid refresh token', 401);
        }
      }

      // User lookup to ensure they are still active
      const user = await prisma.employee.findUnique({ where: { id: decoded.id } });
      if (!user || user.status !== 'ACTIVE') {
        throw new AppError('User not found or inactive', 401);
      }

      const tokens = this.generateTokens(user);
      
      // Update refresh token in Redis
      if (redis) {
        await redis.set(`refresh:${user.id}`, tokens.refreshToken, 'EX', 7 * 24 * 60 * 60);
      }

      return tokens;
    } catch (err) {
      throw new AppError('Invalid or expired refresh token', 401);
    }
  }

  generateTokens(user) {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = jwt.sign(payload, config.jwtSecret, { expiresIn: '15m' });
    const refreshToken = jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' });

    return { accessToken, refreshToken };
  }

  sanitizeUser(user) {
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }
}

module.exports = new AuthService();
