/**
 * Central configuration loader.
 * Validates all required env vars at startup — fail fast if anything is missing.
 */

const dotenv = require('dotenv');
const path = require('path');

// Load .env — try server/ directory first (where Prisma expects it), then project root
const serverEnv = path.resolve(__dirname, '../../.env');
const rootEnv = path.resolve(__dirname, '../../../.env');
dotenv.config({ path: serverEnv });
dotenv.config({ path: rootEnv }); // won't override already-set vars

const requiredVars = [
  'DATABASE_URL',
  'MONGODB_URI',
  'REDIS_URL',
  'JWT_SECRET',
];

const missing = requiredVars.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
  console.error('   Copy .env.example to .env and fill in your values.');
  process.exit(1);
}

const config = {
  // Server
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') === 'development',

  // PostgreSQL (Prisma reads DATABASE_URL directly)
  databaseUrl: process.env.DATABASE_URL,

  // MongoDB
  mongoUri: process.env.MONGODB_URI,

  // Redis
  redisUrl: process.env.REDIS_URL,

  // JWT
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // Client
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
};

module.exports = config;
