/**
 * Scheduled Jobs — Overdue Scanner & Booking Status Updater.
 *
 * Runs via node-cron:
 * 1. Overdue scanner: flags allocations past expected_return_date, fires notifications
 * 2. Booking status updater: flips upcoming → ongoing → completed based on current time
 *
 * Both are idempotent — safe to run repeatedly without side effects.
 */

const cron = require('node-cron');
const { prisma } = require('../config/postgres');
const { sendBulkNotifications } = require('../modules/notifications/notificationService');

/**
 * Scan for overdue allocations and fire notifications.
 * Runs every 15 minutes.
 */
function startOverdueScanner() {
  cron.schedule('*/15 * * * *', async () => {
    try {
      const now = new Date();

      // Find allocations that are overdue AND haven't been notified recently
      // (we check for allocations where expectedReturnDate < now, still active)
      const overdueAllocations = await prisma.allocation.findMany({
        where: {
          status: 'ACTIVE',
          expectedReturnDate: { lt: now },
          actualReturnDate: null,
        },
        include: {
          asset: { select: { id: true, assetTag: true, name: true } },
          employeeHolder: { select: { id: true, name: true } },
          departmentHolder: { select: { id: true, name: true } },
        },
      });

      if (overdueAllocations.length === 0) return;

      console.log(`⏰ Overdue scanner: found ${overdueAllocations.length} overdue allocation(s)`);

      // Build notification batch for employee holders
      const notifications = overdueAllocations
        .filter((a) => a.employeeHolderId)
        .map((a) => {
          const daysOverdue = Math.floor(
            (now - new Date(a.expectedReturnDate)) / (1000 * 60 * 60 * 24)
          );
          return {
            userId: a.employeeHolderId,
            type: 'OVERDUE_RETURN',
            message: `Asset ${a.asset.assetTag} (${a.asset.name}) is ${daysOverdue} day(s) overdue for return.`,
            relatedEntityId: a.id,
            relatedEntityType: 'allocation',
            metadata: {
              assetTag: a.asset.assetTag,
              expectedReturnDate: a.expectedReturnDate,
              daysOverdue,
            },
          };
        });

      if (notifications.length > 0) {
        await sendBulkNotifications(notifications);
      }
    } catch (err) {
      console.error('❌ Overdue scanner error:', err.message);
    }
  });

  console.log('⏰ Overdue scanner scheduled (every 15 minutes)');
}

/**
 * Update booking statuses based on current time:
 * - UPCOMING → ONGOING when startTime has passed
 * - ONGOING → COMPLETED when endTime has passed
 *
 * Runs every 5 minutes.
 */
function startBookingStatusUpdater() {
  cron.schedule('*/5 * * * *', async () => {
    try {
      const now = new Date();

      // Flip UPCOMING → ONGOING
      const startedResult = await prisma.booking.updateMany({
        where: {
          status: 'UPCOMING',
          startTime: { lte: now },
        },
        data: { status: 'ONGOING' },
      });

      // Flip ONGOING → COMPLETED
      const completedResult = await prisma.booking.updateMany({
        where: {
          status: 'ONGOING',
          endTime: { lte: now },
        },
        data: { status: 'COMPLETED' },
      });

      const started = startedResult.count;
      const completed = completedResult.count;

      if (started > 0 || completed > 0) {
        console.log(
          `📅 Booking updater: ${started} started, ${completed} completed`
        );
      }
    } catch (err) {
      console.error('❌ Booking status updater error:', err.message);
    }
  });

  console.log('📅 Booking status updater scheduled (every 5 minutes)');
}

/**
 * Generate booking reminder notifications.
 * Runs every 30 minutes — sends reminders for bookings starting in the next hour.
 */
function startBookingReminder() {
  cron.schedule('*/30 * * * *', async () => {
    try {
      const now = new Date();
      const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

      const upcomingBookings = await prisma.booking.findMany({
        where: {
          status: 'UPCOMING',
          startTime: {
            gte: now,
            lte: oneHourLater,
          },
        },
        include: {
          asset: { select: { assetTag: true, name: true, location: true } },
          bookedBy: { select: { id: true, name: true } },
        },
      });

      if (upcomingBookings.length === 0) return;

      const notifications = upcomingBookings.map((b) => {
        const minutesUntil = Math.round(
          (new Date(b.startTime) - now) / (1000 * 60)
        );
        return {
          userId: b.bookedBy.id,
          type: 'BOOKING_REMINDER',
          message: `Reminder: Your booking for ${b.asset.name} (${b.asset.assetTag})${b.asset.location ? ` at ${b.asset.location}` : ''} starts in ${minutesUntil} minutes.`,
          relatedEntityId: b.id,
          relatedEntityType: 'booking',
        };
      });

      await sendBulkNotifications(notifications);
      console.log(`🔔 Booking reminders sent: ${notifications.length}`);
    } catch (err) {
      console.error('❌ Booking reminder error:', err.message);
    }
  });

  console.log('🔔 Booking reminder scheduled (every 30 minutes)');
}

module.exports = {
  startOverdueScanner,
  startBookingStatusUpdater,
  startBookingReminder,
};
