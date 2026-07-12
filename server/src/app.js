// AssetFlow - Phase 0 Entry Point
// Dev A & B shared contract

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');

const config = require('./config');
const { connectPostgres, disconnectPostgres } = require('./config/postgres');
const { connectMongo, disconnectMongo } = require('./config/mongo');
const { connectRedis, disconnectRedis, getRedisSub } = require('./config/redis');

// Socket.io for Real-time
const { Server } = require('socket.io');

const { apiLimiter } = require('./middleware/rateLimiter');
const sanitizer = require('./middleware/sanitizer');
const activityLogger = require('./middleware/activityLogger');
const errorHandler = require('./middleware/errorHandler');

const eventBus = require('./core/eventBus');

// Phase 1A routes
const authRoutes = require('./modules/auth/auth.routes');
const departmentsRoutes = require('./modules/departments/departments.routes');
const categoriesRoutes = require('./modules/categories/categories.routes');
const employeesRoutes = require('./modules/employees/employees.routes');
const allocationsRoutes = require('./modules/allocations/allocations.routes');
const transfersRoutes = require('./modules/transfers/transfers.routes');
const maintenanceRoutes = require('./modules/maintenance/maintenance.routes');

// Phase 2B routes
const bookingsRoutes    = require('./modules/bookings/bookings.routes');

// Phase 4 routes
const auditsRoutes      = require('./modules/audits/audits.routes');

// Cron jobs
const {
  startOverdueScanner,
  startBookingStatusUpdater,
  startBookingReminder,
} = require('./jobs/overdueScanner');

// Dev B - Phase 1 & 2 Routes
const assetsRoutes = require('./modules/assets/assets.routes');

// Dev B - Phase 3 Routes
const notificationsRoutes = require('./modules/notifications/notifications.routes');
const dashboardRoutes = require('./modules/dashboard/dashboard.routes');

// Dev B - Phase 3 Listeners
require('./modules/notifications/notifications.events'); // Attach event listeners

// Dev B - Cron Jobs
const startBookingJob = require('./jobs/bookingStatusUpdater');

const app = express();
const server = http.createServer(app);

// isko global context me daal diya taaki saare modules emit kar sake
app.set('eventBus', eventBus);

app.use(helmet());
app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// api rate limiting and noSQL/XSS injection rokne ke liye
app.use('/api/', apiLimiter);
app.use(sanitizer); // NoSQL sanitizer
const xssSanitizer = require('./middleware/sanitize'); // XSS sanitizer
app.use(xssSanitizer);

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
app.use('/api/departments', departmentsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/allocations', allocationsRoutes);
app.use('/api/transfers', transfersRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/bookings',    bookingsRoutes);

// Dev B Routes
app.use('/api/assets', assetsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Phase 4 - Audits
app.use('/api/audit-cycles', auditsRoutes);

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

    // Start Cron Jobs
    startBookingJob();

    // Socket.io Setup
    const io = new Server(server, { 
      cors: { origin: config.clientUrl, credentials: true } 
    });

    io.on('connection', (socket) => {
      // Frontend se userId pass hoga connection query me
      const userId = socket.handshake.query.userId || 'dummy-user-id';
      socket.join(`user_${userId}`);
      console.log(`🔌 Naya socket connect hua user ke liye: ${userId}`);
      
      socket.on('disconnect', () => {
        console.log(`🔌 Socket disconnect ho gaya user: ${userId}`);
      });
    });

    // Redis Pub/Sub Subscription for Real-time push
    const sub = getRedisSub();
    sub.psubscribe('notifications:*');
    
    sub.on('pmessage', (pattern, channel, message) => {
      // channel hoga jaise 'notifications:user123'
      const targetUserId = channel.split(':')[1];
      const notificationData = JSON.parse(message);
      
      // Srif usi user ko bhejo jiska notification hai
      io.to(`user_${targetUserId}`).emit('naya_notification', notificationData);
    });

    server.listen(config.port, () => {
      console.log(`\n✅ API running on http://localhost:${config.port}`);
      console.log(`   Client URL:  ${config.clientUrl}\n`);

      // ── Start Phase 2A cron jobs ─────────────────────────────────
      startOverdueScanner();        // every 15 min: ACTIVE → OVERDUE
      startBookingStatusUpdater();  // every 5 min:  booking status transitions
      startBookingReminder();       // every 30 min: upcoming booking reminders
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
