// AssetFlow - Phase 0 Entry Point
// Dev A & B shared contract

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');

const config = require('./config');
const { connectPostgres, disconnectPostgres } = require('./config/postgres');
const { connectMongo, disconnectMongo } = require('./config/mongo');
const { connectRedis, disconnectRedis } = require('./config/redis');

const { apiLimiter } = require('./middleware/rateLimiter');
const sanitizer = require('./middleware/sanitizer');
const activityLogger = require('./middleware/activityLogger');
const errorHandler = require('./middleware/errorHandler');

const eventBus = require('./core/eventBus');

// Sirf auth ready hai phase 0 ke liye
const authRoutes = require('./modules/auth/routes');

const app = express();
const server = http.createServer(app);

// isko global context me daal diya taaki saare modules emit kar sake
app.set('eventBus', eventBus);

app.use(helmet());
app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// api rate limiting and noSQL injection rokne ke liye
app.use('/api/', apiLimiter);
app.use(sanitizer());

// Har state change pe Mongo me log daalne ka jugaad
app.use(activityLogger);

// basic health check endpoint for testing
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'AssetFlow API',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.use('/api/auth', authRoutes);

app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found bhai.' });
});

app.use(errorHandler);

async function start() {
  try {
    console.log('🚀 Starting AssetFlow API (Phase 0)...\n');

    // teeno DBs ek sath connect karte hai time bachaane ke liye
    await Promise.all([
      connectPostgres(),
      connectMongo(),
      connectRedis(),
    ]);

    console.log('');

    server.listen(config.port, () => {
      console.log(`\n✅ API running on http://localhost:${config.port}`);
      console.log(`   Client URL:  ${config.clientUrl}\n`);
    });
  } catch (err) {
    console.error('❌ Startup me error aa gaya:', err);
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.log(`\n🛑 ${signal} aaya hai. Gracefully band kar rahe hai...`);

  server.close(async () => {
    try {
      await Promise.all([
        disconnectPostgres(),
        disconnectMongo(),
        disconnectRedis(),
      ]);
      console.log('👋 Sab connections close ho gaye. Bye.');
      process.exit(0);
    } catch (err) {
      console.error('❌ Shutdown me issue hua:', err);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error('⚠️  10s timeout ho gaya, forcefully closing');
    process.exit(1);
  }, 10000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start();

module.exports = { app, server, eventBus };
