const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const eventBus = require('../core/eventBus');

// Booking Status Updater Job
 //  Runs every 5 minutes.
 // UPCOMING -> ONGOING when start_time <= NOW()
 // ONGOING -> COMPLETED when end_time <= NOW()

// BOOKING KE STATUSES KA KYA HOGA ISKE LIYE 
// YAHA TIME KE HISAB se STATUS AUTOMATIC CHANGE KR SKTE
const updateBookingStatuses = async () => {
  try {
    const now = new Date();

    // 1. UPCOMING -> ONGOING
    const upcomingToOngoing = await prisma.booking.updateMany({
      where: {
        status: 'UPCOMING',
        startTime: { lte: now }
      },
      data: {
        status: 'ONGOING'
      }
    });

    if (upcomingToOngoing.count > 0) {
      console.log(`[Booking Job] Started ${upcomingToOngoing.count} upcoming bookings.`);
      // Optional: Emit event if we need notifications for 'booking.started'
      // eventBus.emit('entity.action', { type: 'booking.started', ... })
    }

    // 2. ONGOING -> COMPLETED
    const ongoingToCompleted = await prisma.booking.updateMany({
      where: {
        status: 'ONGOING',
        endTime: { lte: now }
      },
      data: {
        status: 'COMPLETED'
      }
    });

    if (ongoingToCompleted.count > 0) {
      console.log(`[Booking Job] Completed ${ongoingToCompleted.count} ongoing bookings.`);
      // Optional: Emit event if we need notifications for 'booking.completed'
    }

  } catch (error) {
    console.error('[Booking Job] Error updating booking statuses:', error);
  }
};

// Start the cron job
// Format: minute hour day month dayOfWeek. '*/5 * * * *' = every 5 minutes
const startBookingJob = () => {
  cron.schedule('*/5 * * * *', updateBookingStatuses);
  console.log('[Cron] Booking Status Updater job scheduled (runs every 5 minutes).');
};

module.exports = startBookingJob;
