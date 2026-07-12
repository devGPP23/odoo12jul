/**
 * Prisma client singleton.
 * Reuses a single PrismaClient instance across the app to avoid
 * exhausting the connection pool during development (nodemon restarts).
 */

const { PrismaClient } = require('@prisma/client');
const config = require('./index');

/** @type {PrismaClient} */
let prisma;

if (config.isDev) {
  // In dev, attach to globalThis so nodemon restarts don't leak connections
  if (!globalThis.__prisma) {
    globalThis.__prisma = new PrismaClient({
      log: ['warn', 'error'],
    });
  }
  prisma = globalThis.__prisma;
} else {
  prisma = new PrismaClient({
    log: ['warn', 'error'],
  });
}

/**
 * Test the Postgres connection and log the result.
 */
async function connectPostgres() {
  try {
    await prisma.$connect();
    console.log('✅ PostgreSQL connected (Prisma)');
  } catch (err) {
    console.error('❌ PostgreSQL connection failed:', err.message);
    throw err;
  }
}

/**
 * Graceful disconnect.
 */
async function disconnectPostgres() {
  await prisma.$disconnect();
  console.log('🔌 PostgreSQL disconnected');
}

module.exports = { prisma, connectPostgres, disconnectPostgres };
