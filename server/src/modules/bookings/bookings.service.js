/**
 * Bookings Service — Phase 2B (2B.1 – 2B.6)
 *
 * Implements the booking conflict engine for bookable assets (rooms, projectors).
 *
 * Design philosophy:
 *   - DO NOT pre-check with SELECT. The INSERT itself IS the conflict check.
 *   - Postgres EXCLUDE USING gist constraint (booking_no_overlap) rejects overlap.
 *   - We catch the 23P01 error code and translate to a friendly 409 response.
 *
 * Edge cases implemented:
 *   B1 - Past booking block: start_time >= NOW()
 *   B2 - Non-bookable asset: bookings only for isBookable=true
 *   B3 - Asset under maintenance: block booking if status='UNDER_MAINTENANCE'
 *   B4 - Adjacent bookings allowed: half-open intervals [start, end)
 *   B5 - Max duration: enforce a 12-hour cap per booking
 *   B6 - Idempotent cancel: cancelling already-cancelled booking is no-op
 *   B7 - Reschedule atomicity: cancel+cancel+create in one tx, rollback on overlap
 *   B8 - Past-end can't cancel: don't allow cancelling already-completed bookings
 */

const { prisma } = require('../../config/postgres');
const AppError = require('../../utils/AppError');
const eventBus = require('../../core/eventBus');

const MAX_BOOKING_HOURS = 12;

class BookingsService {
  /**
   * Create a booking for a bookable asset.
   * INSERT-and-catch pattern — the DB enforces conflict detection.
   */
  async create(data, actor) {
    const { assetId, startTime, endTime } = data;

    // ── B1: start_time must be in the future ────────────────────────
    if (new Date(startTime) < new Date()) {
      throw new AppError('Cannot book a slot in the past.', 400);
    }
    // end_time > start_time
    if (new Date(endTime) <= new Date(startTime)) {
      throw new AppError('endTime must be after startTime.', 400);
    }
    // ── B5: max duration guard ───────────────────────────────────────
    const durationHours = (new Date(endTime) - new Date(startTime)) / (1000 * 60 * 60);
    if (durationHours > MAX_BOOKING_HOURS) {
      throw new AppError(
        `Booking duration cannot exceed ${MAX_BOOKING_HOURS} hours.`,
        400
      );
    }

    // ── Pre-flight asset checks (B2 + B3) ──────────────────────────
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        assetTag: true,
        name: true,
        isBookable: true,
        status: true,
        location: true,
      },
    });
    if (!asset) throw new AppError('Asset not found.', 404);

    // B2: non-bookable asset
    if (!asset.isBookable) {
      throw new AppError(
        `Asset "${asset.assetTag}" is not bookable. Use the allocations API for this asset.`,
        400
      );
    }

    // B3: asset under maintenance
    if (asset.status === 'UNDER_MAINTENANCE') {
      throw new AppError(
        `Asset "${asset.assetTag}" is currently under maintenance and cannot be booked.`,
        400
      );
    }

    if (asset.status === 'DISPOSED' || asset.status === 'RETIRED') {
      throw new AppError(
        `Asset "${asset.assetTag}" is ${asset.status.toLowerCase()} and cannot be booked.`,
        400
      );
    }

    try {
      const booking = await prisma.booking.create({
        data: {
          assetId,
          bookedById: actor.id,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          status: 'UPCOMING',
        },
        include: {
          asset: { select: { id: true, assetTag: true, name: true, location: true } },
          bookedBy: { select: { id: true, name: true, email: true } },
        },
      });

      // Emit event
      setImmediate(() => {
        eventBus.emit('entity.action', {
          type: 'booking.created',
          actorId: actor.id,
          actorName: actor.name,
          entityType: 'booking',
          entityId: booking.id,
          relatedAssetId: assetId,
          departmentId: actor.departmentId || null,
          data: {
            assetTag: asset.assetTag,
            assetName: asset.name,
            startTime: booking.startTime,
            endTime: booking.endTime,
          },
          timestamp: new Date().toISOString(),
        });
      });

      return booking;
    } catch (err) {
      // ── Catch the GiST exclusion violation (Postgres 23P01) ────────
      if (
        err.code === '23P01' ||
        (err.message && err.message.toLowerCase().includes('exclusion constraint'))
      ) {
        // Find the conflicting booking for a friendlier error response.
        const conflictingBooking = await prisma.booking.findFirst({
          where: {
            assetId,
            status: { in: ['UPCOMING', 'ONGOING'] },
            // Overlap check (half-open)
            startTime: { lt: new Date(endTime) },
            endTime: { gt: new Date(startTime) },
          },
          include: {
            bookedBy: { select: { id: true, name: true } },
            asset: { select: { assetTag: true, name: true } },
          },
        });

        const details = {
          assetTag: asset.assetTag,
          assetName: asset.name,
          requestedSlot: {
            start: startTime,
            end: endTime,
          },
          conflictingBooking: conflictingBooking
            ? {
                bookingId: conflictingBooking.id,
                bookedBy: conflictingBooking.bookedBy.name,
                bookedById: conflictingBooking.bookedById,
                start: conflictingBooking.startTime,
                end: conflictingBooking.endTime,
                formattedTime: this._formatSlot(
                  conflictingBooking.startTime,
                  conflictingBooking.endTime
                ),
              }
            : null,
        };

        const e = new AppError(
          `Time slot conflicts with an existing booking for asset "${asset.assetTag}".`,
          409
        );
        e.details = details;
        throw e;
      }

      // ── Other Prisma errors → bubble up ─────────────────────────────
      throw err;
    }
  }

  /**
   * Calendar read: GET /api/bookings?assetId=X&date=Y
   * Returns all bookings for an asset on a given date.
   */
  async calendar({ assetId, date }) {
    if (!assetId || !date) {
      throw new AppError('assetId and date are required.', 400);
    }

    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const bookings = await prisma.booking.findMany({
      where: {
        assetId,
        status: { in: ['UPCOMING', 'ONGOING', 'COMPLETED'] },
        // Window overlaps the requested day
        startTime: { lt: dayEnd },
        endTime: { gt: dayStart },
      },
      orderBy: { startTime: 'asc' },
      include: {
        bookedBy: { select: { id: true, name: true } },
      },
    });

    return {
      date,
      assetId,
      bookings: bookings.map((b) => ({
        ...b,
        formattedSlot: this._formatSlot(b.startTime, b.endTime),
      })),
    };
  }

  /**
   * List bookings with filters and pagination.
   */
  async list(filters = {}) {
    const { assetId, bookedById, status } = filters;
    const page = parseInt(filters.page, 10) || 1;
    const limit = parseInt(filters.limit, 10) || 50;
    const skip = (page - 1) * limit;

    const where = {};
    if (assetId) where.assetId = assetId;
    if (bookedById) where.bookedById = bookedById;
    if (status) where.status = status;

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startTime: 'asc' },
        include: {
          asset: { select: { id: true, assetTag: true, name: true, location: true } },
          bookedBy: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.booking.count({ where }),
    ]);

    return {
      data: bookings.map((b) => ({
        ...b,
        formattedSlot: this._formatSlot(b.startTime, b.endTime),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Cancel a booking. B6: idempotent on already-cancelled.
   * B8: refuse to cancel if already completed.
   */
  async cancel(bookingId, actor) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        asset: { select: { assetTag: true, name: true } },
        bookedBy: { select: { id: true, name: true } },
      },
    });

    if (!booking) throw new AppError('Booking not found.', 404);

    // Authorization: booker or any manager-role
    const isAuthorized =
      booking.bookedById === actor.id ||
      ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD'].includes(actor.role);
    if (!isAuthorized) {
      throw new AppError('You do not have permission to cancel this booking.', 403);
    }

    // B6: Already cancelled → no-op idempotent return
    if (booking.status === 'CANCELLED') {
      return booking;
    }

    // B8: Already completed bookings cannot be cancelled
    if (booking.status === 'COMPLETED') {
      throw new AppError(
        'Booking has already completed and cannot be cancelled.',
        400
      );
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
      eventBus.emit('entity.action', {
        type: 'booking.cancelled',
        actorId: actor.id,
        actorName: actor.name,
        entityType: 'booking',
        entityId: bookingId,
        relatedAssetId: booking.assetId,
        affectedUserId: booking.bookedById,
        data: {
          assetTag: booking.asset.assetTag,
          originalStart: booking.startTime,
          originalEnd: booking.endTime,
        },
        timestamp: new Date().toISOString(),
      });
    });

    return updated;
  }

  /**
   * Reschedule — atomic cancel-old + create-new in one transaction.
   * If new slot overlaps, rollback both.
   */
  async reschedule(bookingId, data, actor) {
    const { startTime, endTime } = data;

    if (new Date(startTime) < new Date()) {
      throw new AppError('Cannot reschedule to a past time.', 400);
    }
    if (new Date(endTime) <= new Date(startTime)) {
      throw new AppError('endTime must be after startTime.', 400);
    }
    const durationHours = (new Date(endTime) - new Date(startTime)) / (1000 * 60 * 60);
    if (durationHours > MAX_BOOKING_HOURS) {
      throw new AppError(
        `Booking duration cannot exceed ${MAX_BOOKING_HOURS} hours.`,
        400
      );
    }

    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.booking.findUnique({
          where: { id: bookingId },
        });
        if (!existing) throw new AppError('Booking not found.', 404);

        const isAuthorized =
          existing.bookedById === actor.id ||
          ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD'].includes(actor.role);
        if (!isAuthorized) {
          throw new AppError(
            'You do not have permission to reschedule this booking.',
            403
          );
        }
        if (existing.status === 'COMPLETED' || existing.status === 'CANCELLED') {
          throw new AppError(
            `Booking is already ${existing.status.toLowerCase()} and cannot be rescheduled.`,
            400
          );
        }

        // Cancel old
        await tx.booking.update({
          where: { id: bookingId },
          data: { status: 'CANCELLED' },
        });

        // Try creating new (DB will reject if overlap)
        const newBooking = await tx.booking.create({
          data: {
            assetId: existing.assetId,
            bookedById: existing.bookedById,
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            status: 'UPCOMING',
          },
          include: {
            asset: { select: { id: true, assetTag: true, name: true } },
            bookedBy: { select: { id: true, name: true } },
          },
        });

        return newBooking;
      });
    } catch (err) {
      // Translate exclusion violation → rollback the implicit transaction
      if (
        err.code === '23P01' ||
        (err.message && err.message.toLowerCase().includes('exclusion constraint'))
      ) {
        const e = new AppError(
          'The new time slot conflicts with another booking. Reschedule rolled back.',
          409
        );
        e.details = { rollback: true };
        throw e;
      }
      throw err;
    }
  }

  /**
   * Internal: "9:00–10:00" formatted slot.
   */
  _formatSlot(start, end) {
    const fmt = (d) =>
      new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${fmt(start)}–${fmt(end)}`;
  }
}

module.exports = new BookingsService();