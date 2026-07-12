/**
 * AssetFlow — Main Application Entry Point.
 *
 * Wires together:
 * 1. All three DB connections (Postgres, Mongo, Redis)
 * 2. Express middleware stack
 * 3. All module routes
 * 4. Socket.io for real-time notifications
 * 5. Cron jobs for overdue scanning + booking status updates
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const { Server: SocketServer } = require('socket.io');

// ── Config (validates env vars on import) ────────────────────
const config = require('./config');
const { connectPostgres, disconnectPostgres } = require('./config/postgres');
const { connectMongo, disconnectMongo } = require('./config/mongo');
const { connectRedis, disconnectRedis, getRedisSub } = require('./config/redis');

// ── Middleware ────────────────────────────────────────────────
const { authenticate } = require('./middleware/auth');
const activityLogger = require('./middleware/activityLogger');
const errorHandler = require('./middleware/errorHandler');

// ── Module Routes ────────────────────────────────────────────
const authRoutes = require('./modules/auth/routes');
const departmentRoutes = require('./modules/departments/routes');
const employeeRoutes = require('./modules/employees/routes');
const categoryRoutes = require('./modules/asset-categories/routes');
const assetRoutes = require('./modules/assets/routes');
const allocationRoutes = require('./modules/allocations/routes');
const bookingRoutes = require('./modules/bookings/routes');
const maintenanceRoutes = require('./modules/maintenance/routes');
const auditRoutes = require('./modules/audits/routes');
const dashboardRoutes = require('./modules/dashboard/routes');
const notificationRoutes = require('./modules/notifications/routes');
const reportRoutes = require('./modules/reports/routes');
const activityLogRoutes = require('./modules/activity-logs/routes');

// ── Jobs ─────────────────────────────────────────────────────
const { startOverdueScanner, startBookingStatusUpdater } = require('./jobs/overdueScanner');

// ── Express App ──────────────────────────────────────────────
const app = express();
const server = http.createServer(app);

// ── Socket.io ────────────────────────────────────────────────
const io = new SocketServer(server, {
  cors: {
    origin: config.clientUrl,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Make io accessible to the rest of the app
app.set('io', io);

// ── Global Middleware ────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: config.clientUrl,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Activity logger — logs all state-changing requests to MongoDB
app.use(activityLogger);

// ── Health Check ─────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'AssetFlow API',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ── API Routes ───────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/asset-categories', categoryRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/allocations', allocationRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/maintenance-requests', maintenanceRoutes);
app.use('/api/audit-cycles', auditRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/activity-logs', activityLogRoutes);

// ── 404 Handler ──────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found.',
  });
});

// ── Centralized Error Handler ────────────────────────────────
app.use(errorHandler);

// ── Socket.io Connection Handling ────────────────────────────
io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  // Client sends their userId after auth
  socket.on('register', (userId) => {
    if (userId) {
      socket.join(`user:${userId}`);
      console.log(`👤 User ${userId} registered for real-time notifications`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Socket disconnected: ${socket.id}`);
  });
});

// Subscribe to Redis notification channels and forward to Socket.io
async function setupRedisSubscriptions() {
  try {
    const sub = getRedisSub();
    if (!sub) return;

    // Pattern subscribe to all notification channels
    await sub.psubscribe('notifications:*');

    sub.on('pmessage', (_pattern, channel, message) => {
      // channel = 'notifications:<userId>'
      const userId = channel.split(':')[1];
      if (userId) {
        io.to(`user:${userId}`).emit('notification', JSON.parse(message));
      }
    });

    console.log('📡 Redis → Socket.io notification bridge active');
  } catch (err) {
    console.error('⚠️  Redis subscription setup failed:', err.message);
  }
}

// ── Startup ──────────────────────────────────────────────────
async function start() {
  try {
    console.log('🚀 Starting AssetFlow API...\n');

    // Connect all three databases in parallel
    await Promise.all([
      connectPostgres(),
      connectMongo(),
      connectRedis(),
    ]);

    console.log(''); // blank line after connection logs

    // Setup Redis → Socket.io bridge
    await setupRedisSubscriptions();

    // Start cron jobs
    startOverdueScanner();
    startBookingStatusUpdater();

    // Start HTTP server
    server.listen(config.port, () => {
      console.log(`\n✅ AssetFlow API running on http://localhost:${config.port}`);
      console.log(`   Environment: ${config.nodeEnv}`);
      console.log(`   Client URL:  ${config.clientUrl}\n`);
    });
  } catch (err) {
    console.error('❌ Startup failed:', err);
    process.exit(1);
  }
}

// ── Graceful Shutdown ────────────────────────────────────────
async function shutdown(signal) {
  console.log(`\n🛑 ${signal} received. Shutting down gracefully...`);

  server.close(async () => {
    try {
      await Promise.all([
        disconnectPostgres(),
        disconnectMongo(),
        disconnectRedis(),
      ]);
      console.log('👋 All connections closed. Goodbye.');
      process.exit(0);
    } catch (err) {
      console.error('❌ Error during shutdown:', err);
      process.exit(1);
    }
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('⚠️  Forced shutdown after 10s timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Start the application
start();

module.exports = { app, server, io };
