// AssetFlow - Unified Entry Point (Phase 0-3)
// All routes from Dev A (apoorv/nishant/om) + Dev B (gp) merged

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
const xssSanitizer = require('./middleware/sanitize');
const activityLogger = require('./middleware/activityLogger');
const errorHandler = require('./middleware/errorHandler');

const eventBus = require('./core/eventBus');

// ─── Phase 1A routes (Dev A - apoorv) ───
const authRoutes = require('./modules/auth/auth.routes');
const departmentsRoutes = require('./modules/departments/departments.routes');
const categoriesRoutes = require('./modules/categories/categories.routes');
const employeesRoutes = require('./modules/employees/employees.routes');

// ─── Phase 1B routes (Dev B - gp) ───
const assetsRoutes = require('./modules/assets/assets.routes');

// ─── Phase 2A routes (Dev A - nishant/om) ───
const allocationsRoutes = require('./modules/allocations/allocations.routes');
const allocationTransfersRoutes = require('./modules/allocations/transfers.routes');
const transfersRoutes = require('./modules/transfers/transfers.routes');
const maintenanceRoutes = require('./modules/maintenance/maintenance.routes');
const auditsRoutes = require('./modules/audits/audits.routes');
const auditItemsRoutes = require('./modules/audits/audit-items.routes');

// ─── Phase 2B routes (Dev B - gp) ───
const bookingsRoutes = require('./modules/bookings/bookings.routes');

// ─── Phase 3B routes (Dev B - gp) ───
const notificationsRoutes = require('./modules/notifications/notifications.routes');
const dashboardRoutes = require('./modules/dashboard/dashboard.routes');
const activityRoutes = require('./modules/activity/activity.routes');
const reportsRoutes = require('./modules/reports/reports.routes');

// Phase 3B Listeners
require('./modules/notifications/notifications.events');
require('./modules/bookings/bookings.events');

// Removed duplicate

// Cron jobs
const {
  startOverdueScanner,
  startBookingStatusUpdater,
  startBookingReminder,
} = require('./jobs/overdueScanner');
// Cleaned up conflict markers
const startBookingJob = require('./jobs/bookingStatusUpdater');

const app = express();
const server = http.createServer(app);

app.set('eventBus', eventBus);

app.use(helmet());
app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/', apiLimiter);
app.use(sanitizer);
// Removed duplicate declaration
app.use(xssSanitizer);
app.use(activityLogger);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'AssetFlow API',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ─── Mount ALL routes ───
app.use('/api/auth', authRoutes);
app.use('/api/departments', departmentsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/assets', assetsRoutes);
app.use('/api/allocations', allocationsRoutes);
app.use('/api/allocations', allocationTransfersRoutes); // Nishant's transfer routes nested under allocations
app.use('/api/transfers', transfersRoutes);              // GP's standalone transfers module
app.use('/api/bookings', bookingsRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/audit-cycles', auditsRoutes);
app.use('/api/audit-items', auditItemsRoutes);
app.use('/api/activity-logs', activityRoutes);
app.use('/api/reports', reportsRoutes);

// Phase 4 - Audits
app.use('/api/audit-cycles', auditsRoutes);

app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found bhai.' });
});

app.use(errorHandler);

async function start() {
  try {
    console.log('🚀 Starting AssetFlow API...\n');

    await Promise.all([
      connectPostgres(),
      connectMongo(),
      connectRedis(),
    ]);

    console.log('');

    // Start Dev B cron
    startBookingJob();

    // Socket.io Setup
    const io = new Server(server, {
      cors: { origin: config.clientUrl, credentials: true }
    });

    io.on('connection', (socket) => {
      const userId = socket.handshake.query.userId || 'dummy-user-id';
      socket.join(`user_${userId}`);
      console.log(`🔌 Socket connected for user: ${userId}`);

      socket.on('disconnect', () => {
        console.log(`🔌 Socket disconnected for user: ${userId}`);
      });
    });

    // Redis Pub/Sub for real-time notifications
    const sub = getRedisSub();
    sub.psubscribe('notifications:*');

    sub.on('pmessage', (pattern, channel, message) => {
      const targetUserId = channel.split(':')[1];
      const notificationData = JSON.parse(message);
      io.to(`user_${targetUserId}`).emit('naya_notification', notificationData);
    });

    server.listen(config.port, () => {
      console.log(`\n✅ API running on http://localhost:${config.port}`);
      console.log(`   Client URL:  ${config.clientUrl}\n`);

      // Dev A cron jobs
      startOverdueScanner();
      startBookingStatusUpdater();
      startBookingReminder();
    });
  } catch (err) {
    console.error('❌ Startup error:', err);
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.log(`\n🛑 ${signal} received. Shutting down gracefully...`);

  server.close(async () => {
    try {
      await Promise.all([
        disconnectPostgres(),
        disconnectMongo(),
        disconnectRedis(),
      ]);
      console.log('👋 All connections closed. Bye.');
      process.exit(0);
    } catch (err) {
      console.error('❌ Shutdown error:', err);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error('⚠️  10s timeout, force closing');
    process.exit(1);
  }, 10000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start();

module.exports = { app, server, eventBus };
