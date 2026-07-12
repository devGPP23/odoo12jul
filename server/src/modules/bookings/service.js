/**
 * Bookings Module — Service Layer.
 * Overlap validation is enforced by the Postgres EXCLUDE USING gist constraint.
 * The INSERT itself IS the check — no pre-check SELECT (that's a race condition).
 */

const { prisma } = require('../../config/postgres');
const { transitionAssetStatus } = require('../assets/stateMachine');
const { sendNotification } = require('../notifications/notificationService');
const AppError = require('../../utils/AppError');

/**
 * Create a booking.
 * Overlap is rejected at the DB layer via exclusion constraint.
 * We catch the Postgres error 23P01 and return a 409 with details.
 */
async function createBooking({ assetId, bookedById, startTime, endTime }) {
  // Validate asset exists and is bookable
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { id: true, assetTag: true, name: true, isBookable: true, status: true },
  });

  if (!asset) throw new AppError('Asset not found.', 404);
  if (!asset.isBookable) {
    throw new AppError(`Asset ${asset.assetTag} is not marked as bookable.`, 400);
  }

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (start >= end) {
    throw new AppError('Start time must be before end time.', 400);
  }
  if (start < new Date()) {
    throw new AppError('Cannot book in the past.', 400);
  }

  try {
    // Use raw query to leverage the tstzrange exclusion constraint.
    // The INSERT itself is the overlap check — if it overlaps, Postgres rejects it.
    const booking = await prisma.$queryRaw`
      INSERT INTO bookings (id, asset_id, booked_by_id, start_time, end_time, status, created_at, updated_at)
      VALUES (gen_random_uuid(), ${assetId}::uuid, ${bookedById}::uuid, ${start}, ${end}, 'UPCOMING', NOW(), NOW())
      RETURNING id, asset_id as "assetId", booked_by_id as "bookedById", start_time as "startTime", end_time as "endTime", status
    `;

    // Notify booker
    setImmediate(() => {
      sendNotification({
        userId: bookedById,
        type: 'BOOKING_CONFIRMED',
        message: `Booking confirmed for ${asset.name} (${asset.assetTag}) from ${start.toISOString()} to ${end.toISOString()}.`,
        relatedEntityId: booking[0].id,
        relatedEntityType: 'booking',
      });
    });

    return booking[0];
  } catch (err) {
    // Catch the exclusion constraint violation (Postgres error 23P01)
    if (err.code === '23P01' || (err.message && err.message.includes('exclusion constraint'))) {
      // Find the conflicting booking to give useful error info
      const conflicting = await prisma.booking.findFirst({
        where: {
          assetId,
          status: { in: ['UPCOMING', 'ONGOING'] },
          startTime: { lt: end },
          endTime: { gt: start },
        },
        include: {
          bookedBy: { select: { id: true, name: true } },
        },
      });

      throw new AppError(
        `Booking conflict: the requested time slot overlaps with an existing booking.`,
        409,
        {
          conflictingBooking: conflicting
            ? {
                id: conflicting.id,
                bookedBy: conflicting.bookedBy,
                startTime: conflicting.startTime,
                endTime: conflicting.endTime,
              }
            : null,
        }
      );
    }
    throw err;
  }
}

/**
 * Get bookings for a resource (calendar view).
 */
async function getBookings({ assetId, date, status, bookedById, page = 1, limit = 50 } = {}) {
  const where = {};
  if (assetId) where.assetId = assetId;
  if (status) where.status = status;
  if (bookedById) where.bookedById = bookedById;

  // If date is provided, get all bookings for that day
  if (date) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    where.OR = [
      { startTime: { gte: dayStart, lte: dayEnd } },
      { endTime: { gte: dayStart, lte: dayEnd } },
      {
        AND: [
          { startTime: { lte: dayStart } },
          { endTime: { gte: dayEnd } },
        ],
      },
    ];
  }

  const skip = (page - 1) * limit;

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: {
        asset: { select: { id: true, assetTag: true, name: true, location: true } },
        bookedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { startTime: 'asc' },
      skip,
      take: limit,
    }),
    prisma.booking.count({ where }),
  ]);

  return { bookings, total, page, limit, totalPages: Math.ceil(total / limit) };
}

/**
 * Cancel a booking.
 */
async function cancelBooking(bookingId, userId) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new AppError('Booking not found.', 404);

  if (!['UPCOMING', 'ONGOING'].includes(booking.status)) {
    throw new AppError(`Cannot cancel a booking with status '${booking.status}'.`, 400);
  }

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { status: 'CANCELLED' },
    include: {
      asset: { select: { id: true, assetTag: true, name: true } },
      bookedBy: { select: { id: true, name: true } },
    },
  });

  setImmediate(() => {
    sendNotification({
      userId: booking.bookedById,
      type: 'BOOKING_CANCELLED',
      message: `Booking for ${updated.asset.name} (${updated.asset.assetTag}) has been cancelled.`,
      relatedEntityId: bookingId,
      relatedEntityType: 'booking',
    });
  });

  return updated;
}

/**
 * Reschedule a booking — cancel old, create new (leveraging the overlap constraint).
 */
async function rescheduleBooking(bookingId, { startTime, endTime }, userId) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, assetId: true, bookedById: true, status: true },
  });

  if (!booking) throw new AppError('Booking not found.', 404);
  if (booking.status !== 'UPCOMING') {
    throw new AppError('Can only reschedule upcoming bookings.', 400);
  }

  return prisma.$transaction(async (tx) => {
    // Cancel old booking
    await tx.booking.update({
      where: { id: bookingId },
      data: { status: 'CANCELLED' },
    });

    // Create new booking (overlap check happens via constraint)
    const start = new Date(startTime);
    const end = new Date(endTime);

    const newBooking = await tx.$queryRaw`
      INSERT INTO bookings (id, asset_id, booked_by_id, start_time, end_time, status, created_at, updated_at)
      VALUES (gen_random_uuid(), ${booking.assetId}::uuid, ${booking.bookedById}::uuid, ${start}, ${end}, 'UPCOMING', NOW(), NOW())
      RETURNING id, asset_id as "assetId", booked_by_id as "bookedById", start_time as "startTime", end_time as "endTime", status
    `;

    return newBooking[0];
  });
}

module.exports = {
  createBooking,
  getBookings,
  cancelBooking,
  rescheduleBooking,
};
