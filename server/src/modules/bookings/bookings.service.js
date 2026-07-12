const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const AppError = require('../../utils/AppError');
const eventBus = require('../../core/eventBus');


 // Booking Engine Service
 // Implements the INSERT-and-catch pattern for booking overlaps.
 // DEKH LE YAR KI NAYI BOOKING overlap TOH NHI KR RHI KISI SE 

 // yahi imp hai issi se  booking banegi
 
exports.createBooking = async (bookingData, userId) => {
  const { assetId, startTime, endTime } = bookingData;
  // 1. Basic Validations (B1-B8 Edge Cases)
  const start = new Date(startTime);
  const end = new Date(endTime);
  
  if (start < new Date()) {
    throw new AppError('Start time cannot be in the past', 400);
  }
  if (start >= end) {
    throw new AppError('End time must be after start time', 400);
  }
  
  const durationHours = (end - start) / (1000 * 60 * 60);
  if (durationHours > 24) {
    throw new AppError('Max booking duration is 24 hours', 400);
  }

  // 2. Fetch Asset to check bookability
  const asset = await prisma.asset.findUnique({
    where: { id: assetId }
  });

  if (!asset) {
    throw new AppError('Asset not found', 404);
  }
  if (!asset.isBookable) {
    throw new AppError('This asset is not bookable', 400);
  }
  if (asset.status === 'UNDER_MAINTENANCE' || asset.status === 'under_maintenance') {
    throw new AppError('Cannot book an asset that is under maintenance', 400);
  }

  // 3. The INSERT-and-catch pattern (No SELECT pre-check for overlaps!)
  try {
    const booking = await prisma.booking.create({
      data: {
        assetId,
        bookedById: userId,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        status: 'UPCOMING'
      },
      include: {
        asset: true,
        bookedBy: {
          select: { name: true }
        }
      }
    });

    // Emit event for Notification/ActivityLog (3B.1 handler will catch this)
    // AGYA HAI AISA EVENT EMIT KR RHE APAN
    eventBus.emit('entity.action', {
      type: 'booking.created',
      actorId: userId,
      actorName: booking.bookedBy.name,
      entityType: 'booking',
      entityId: booking.id,
      relatedAssetId: assetId,
      data: {
        targetUserId: userId,
        startTime: booking.startTime,
        endTime: booking.endTime
      },
      timestamp: new Date().toISOString()
    });

    return booking;

  } catch (error) {
    // Catch Postgres Exclusion Violation (23P01)
    if (
      error.code === 'P2004' || 
      (error.meta && error.meta.code === '23P01') || 
      error.message.includes('23P01')
    ) {
      // Find the conflicting booking to return detailed 409 message
      const conflict = await prisma.booking.findFirst({
        where: {
          assetId,
          status: { in: ['UPCOMING', 'ONGOING'] },
          startTime: { lt: new Date(endTime) },
          endTime: { gt: new Date(startTime) }
        },
        include: { bookedBy: true }
      });
      
      let errorMsg = 'Conflicts with an existing booking in this time slot';
      if (conflict) {
        const cStart = conflict.startTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const cEnd = conflict.endTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        errorMsg = `Conflicts with ${conflict.bookedBy.name}'s booking ${cStart}-${cEnd}`;
      }
      throw new AppError(errorMsg, 409);
    }
    
    throw error;
  }
};

// FILTER AUR SEATCH KAR SAKTE YAHA SE
// Calendar Data (Get Bookings)
exports.getBookings = async (filters) => {
  const { assetId, date } = filters;
  
  const query = {};
  if (assetId) query.assetId = assetId;

  if (date) {
    // If a specific date is provided, find bookings that overlap with that day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    query.OR = [
      {
        startTime: {
          lte: endOfDay,
        },
        endTime: {
          gte: startOfDay,
        }
      }
    ];
  }

  const bookings = await prisma.booking.findMany({
    where: query,
    include: {
      bookedBy: { select: { id: true, name: true } },
      asset: { select: { id: true, name: true, assetTag: true } }
    },
    orderBy: { startTime: 'asc' }
  });

  return bookings;
};

//  Cancel Booking KARNE KA FUNCTION 

exports.cancelBooking = async (bookingId, userId) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { asset: true, bookedBy: true }
  });

  if (!booking) {
    throw new AppError('Booking not found', 404);
  }

  // Assuming only the creator can cancel their booking (in a real app, Admins could too)
  if (booking.bookedById !== userId) {
    throw new AppError('You do not have permission to cancel this booking', 403);
  }

  if (booking.status === 'CANCELLED') {
    throw new AppError('Booking is already cancelled', 400);
  }

  if (booking.status === 'COMPLETED') {
    throw new AppError('Cannot cancel a completed booking', 400);
  }

  // Update status
  const updatedBooking = await prisma.booking.update({
    where: { id: bookingId },
    data: { status: 'CANCELLED' }
  });

  // Emit event
  eventBus.emit('entity.action', {
    type: 'booking.cancelled',
    actorId: userId,
    actorName: booking.bookedBy.name,
    entityType: 'booking',
    entityId: booking.id,
    relatedAssetId: booking.assetId,
    data: {
      targetUserId: booking.bookedById,
      assetName: booking.asset.name
    },
    timestamp: new Date().toISOString()
  });

  return updatedBooking;
};

//Reschedule Booking - BOOKING KO WAPAS SE RESCHEDULE /UPDATE KR SKTE 
exports.rescheduleBooking = async (bookingId, newStartTime, newEndTime, userId) => {
  const start = new Date(newStartTime);
  const end = new Date(newEndTime);

  if (start < new Date()) {
    throw new AppError('Start time cannot be in the past', 400);
  }
  if (start >= end) {
    throw new AppError('End time must be after start time', 400);
  }
  
  const durationHours = (end - start) / (1000 * 60 * 60);
  if (durationHours > 24) {
    throw new AppError('Max booking duration is 24 hours', 400);
  }

  // Find existing booking
  const existingBooking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { asset: true, bookedBy: true }
  });

  if (!existingBooking) {
    throw new AppError('Booking not found', 404);
  }

  if (existingBooking.bookedById !== userId) {
    throw new AppError('You do not have permission to reschedule this booking', 403);
  }

  if (existingBooking.status === 'CANCELLED' || existingBooking.status === 'COMPLETED') {
    throw new AppError('Cannot reschedule a cancelled or completed booking', 400);
  }

  try {
    // Transaction: Cancel old + Create new. If new overlaps, Postgres 23P01 will rollback the whole transaction!
    const [cancelledBooking, newBooking] = await prisma.$transaction([
      prisma.booking.update({
        where: { id: bookingId },
        data: { status: 'CANCELLED' }
      }),
      prisma.booking.create({
        data: {
          assetId: existingBooking.assetId,
          bookedById: userId,
          startTime: new Date(newStartTime),
          endTime: new Date(newEndTime),
          status: 'UPCOMING'
        }
      })
    ]);

    // Emit event for reschedule (or created)
    eventBus.emit('entity.action', {
      type: 'booking.created', // Treating reschedule as a new booking creation for notifications
      actorId: userId,
      actorName: existingBooking.bookedBy.name,
      entityType: 'booking',
      entityId: newBooking.id,
      relatedAssetId: existingBooking.assetId,
      data: {
        targetUserId: userId,
        startTime: newBooking.startTime,
        endTime: newBooking.endTime,
        isReschedule: true,
        oldBookingId: existingBooking.id
      },
      timestamp: new Date().toISOString()
    });

    return newBooking;

  } catch (error) {
    if (
      error.code === 'P2004' || 
      (error.meta && error.meta.code === '23P01') || 
      error.message.includes('23P01')
    ) {
      // Find the conflicting booking to return detailed 409 message
      const conflict = await prisma.booking.findFirst({
        where: {
          assetId: existingBooking.assetId,
          id: { not: bookingId },
          status: { in: ['UPCOMING', 'ONGOING'] },
          startTime: { lt: new Date(newEndTime) },
          endTime: { gt: new Date(newStartTime) }
        },
        include: { bookedBy: true }
      });
      
      let errorMsg = 'The new time slot conflicts with an existing booking. Reschedule failed.';
      if (conflict) {
        const cStart = conflict.startTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const cEnd = conflict.endTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        errorMsg = `Conflicts with ${conflict.bookedBy.name}'s booking ${cStart}-${cEnd}. Reschedule failed.`;
      }
      throw new AppError(errorMsg, 409);
    }
    
    throw error;
  }
};
