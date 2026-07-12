/**
 * Scheduled Jobs — Overdue Scanner & Booking Status Updater.
 *
 * Runs via node-cron:
 * 1. Overdue scanner  (every 15 min)
 *      UPDATE allocations SET status='OVERDUE'
 *      WHERE expected_return_date < NOW() AND status='ACTIVE'
 *      Emits allocation.overdue events for each affected allocation.
 *
 * 2. Booking status updater (every 5 min)
 *      UPCOMING → ONGOING when startTime <= NOW
 *      ONGOING  → COMPLETED when endTime <= NOW
 *
 * 3. Booking reminder (every 30 min)
 *      Notifies bookers of sessions starting within the next hour.
 *
 * All jobs are idempotent — safe to run repeatedly without side effects.
 */

const cron    = require('node-cron');
const { prisma } = require('../config/postgres');
const eventBus   = require('../core/eventBus');

// Optional: sendBulkNotifications may not exist yet in early phases.
// Gracefully degrade if it's missing.
let sendBulkNotifications;
try {
  ({ sendBulkNotifications } = require('../modules/notifications/notificationService'));
} catch (_) {
  sendBulkNotifications = async () => {}; // no-op until Dev B wires notifications
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. OVERDUE SCANNER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scan for ACTIVE allocations whose expected_return_date has passed,
 * flip their status to OVERDUE, and emit an allocation.overdue event
 * for each one so Dev B's notification handler can fan out.
 *
 * Runs every 15 minutes.
 */
function startOverdueScanner() {
  cron.schedule('*/15 * * * *', async () => {
    try {
      const now = new Date();

      // ── Step 1: Bulk-flip ACTIVE → OVERDUE in a single UPDATE ────────
      // This is the DB-level atomic operation described in 2A.7.
      // Only allocations that have an expectedReturnDate AND it has passed.
      const { count: overdueCount } = await prisma.allocation.updateMany({
        where: {
          status: 'ACTIVE',
          expectedReturnDate: { lt: now },
          actualReturnDate: null,
        },
        data: { status: 'OVERDUE' },
      });

      if (overdueCount === 0) return;

      console.log(`⏰ Overdue scanner: marked ${overdueCount} allocation(s) as OVERDUE`);

      // ── Step 2: Fetch the newly-overdue records to emit events + notify ─
      const overdueAllocations = await prisma.allocation.findMany({
        where: {
          status: 'OVERDUE',
          expectedReturnDate: { lt: now },
          actualReturnDate: null,
        },
        include: {
          asset:            { select: { id: true, assetTag: true, name: true } },
          employeeHolder:   { select: { id: true, name: true, departmentId: true } },
          departmentHolder: { select: { id: true, name: true } },
        },
      });

      if (overdueAllocations.length === 0) return;

      // ── Step 3: Emit allocation.overdue event per allocation ─────────
      for (const alloc of overdueAllocations) {
        const daysOverdue = Math.max(
          1,
          Math.floor((now - new Date(alloc.expectedReturnDate)) / (1000 * 60 * 60 * 24))
        );

        eventBus.emit('entity.action', {
          type: 'allocation.overdue',
          actorId: null,               // system-generated
          actorName: 'System (Cron)',
          entityType: 'allocation',
          entityId: alloc.id,
          relatedAssetId: alloc.assetId,
          departmentId: alloc.employeeHolder?.departmentId || null,
          data: {
            assetTag: alloc.asset.assetTag,
            assetName: alloc.asset.name,
            holderName:
              alloc.employeeHolder?.name || alloc.departmentHolder?.name || 'Unknown',
            holderId: alloc.employeeHolderId || alloc.departmentHolderId,
            expectedReturnDate: alloc.expectedReturnDate,
            daysOverdue,
          },
          timestamp: new Date().toISOString(),
        });
      }

      // ── Step 4: Also send bulk notifications (employee holders only) ──
      const notifications = overdueAllocations
        .filter((a) => a.employeeHolderId)
        .map((a) => {
          const daysOverdue = Math.max(
            1,
            Math.floor((now - new Date(a.expectedReturnDate)) / (1000 * 60 * 60 * 24))
          );
          return {
            userId: a.employeeHolderId,
            type: 'OVERDUE_RETURN',
            message: `Asset ${a.asset.assetTag} (${a.asset.name}) is ${daysOverdue} day(s) overdue for return. Please return it immediately.`,
            relatedEntityId: a.id,
            relatedEntityType: 'allocation',
            metadata: {
              assetTag: a.asset.assetTag,
              assetName: a.asset.name,
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

// ─────────────────────────────────────────────────────────────────────────────
// 2. BOOKING STATUS UPDATER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update booking statuses based on current time:
 *  - UPCOMING → ONGOING  when startTime <= NOW
 *  - ONGOING  → COMPLETED when endTime <= NOW
 *
 * Runs every 5 minutes.
 */
function startBookingStatusUpdater() {
  cron.schedule('*/5 * * * *', async () => {
    try {
      const now = new Date();

      const startedResult = await prisma.booking.updateMany({
        where: { status: 'UPCOMING', startTime: { lte: now } },
        data: { status: 'ONGOING' },
      });

      const completedResult = await prisma.booking.updateMany({
        where: { status: 'ONGOING', endTime: { lte: now } },
        data: { status: 'COMPLETED' },
      });

      const started   = startedResult.count;
      const completed = completedResult.count;

      if (started > 0 || completed > 0) {
        console.log(`📅 Booking updater: ${started} started, ${completed} completed`);
      }
    } catch (err) {
      console.error('❌ Booking status updater error:', err.message);
    }
  });

  console.log('📅 Booking status updater scheduled (every 5 minutes)');
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. BOOKING REMINDER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send reminders for bookings starting in the next hour.
 * Runs every 30 minutes.
 */
function startBookingReminder() {
  cron.schedule('*/30 * * * *', async () => {
    try {
      const now         = new Date();
      const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

      const upcomingBookings = await prisma.booking.findMany({
        where: {
          status: 'UPCOMING',
          startTime: { gte: now, lte: oneHourLater },
        },
        include: {
          asset:    { select: { assetTag: true, name: true, location: true } },
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
          message: `Reminder: Your booking for ${b.asset.name} (${b.asset.assetTag})${
            b.asset.location ? ` at ${b.asset.location}` : ''
          } starts in ${minutesUntil} minute(s).`,
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
