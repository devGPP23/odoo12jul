const bookingsService = require('./bookings.service');
const AppError = require('../../utils/AppError');
const asyncHandler = require('../../utils/asyncHandler');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// HELPER: To bypass Auth for Dev B testing, we fetch Priya's actual DB UUID
const getUserId = async (req) => {
  if (req.user?.id) return req.user.id;
  const priya = await prisma.employee.findFirst({ where: { email: 'priya@assetflow.com' } });
  return priya ? priya.id : 'dummy-user-id';
};

// GET /api/bookings/test/me -> Exposes Priya's ID to frontend so Cancel button works
exports.getTestUser = asyncHandler(async (req, res) => {
  const id = await getUserId(req);
  res.status(200).json({ id });
});

// BOOKING BANAO ROUTE
exports.createBooking = asyncHandler(async (req, res) => {
  const userId = await getUserId(req); 
  const booking = await bookingsService.createBooking(req.body, userId);

  res.status(201).json({
    success: true,
    message: 'Booking created successfully',
    data: booking
  });
});

// 2B.3 - Get Bookings (Calendar Data)
exports.getBookings = asyncHandler(async (req, res) => {
  const { assetId, date } = req.query;

  const bookings = await bookingsService.getBookings({ assetId, date });

  res.status(200).json({
    success: true,
    data: bookings
  });
});

// 2B.4 - Cancel Booking
exports.cancelBooking = asyncHandler(async (req, res) => {
  const userId = await getUserId(req);
  const { id } = req.params;

  const booking = await bookingsService.cancelBooking(id, userId);

  res.status(200).json({
    success: true,
    message: 'Booking cancelled successfully',
    data: booking
  });
});

// 2B.5 - Reschedule Booking
exports.rescheduleBooking = asyncHandler(async (req, res) => {
  const userId = await getUserId(req);
  const { id } = req.params;
  const { newStartTime, newEndTime } = req.body;

  if (!newStartTime || !newEndTime) {
    return res.status(400).json({
      success: false,
      message: 'newStartTime and newEndTime are required'
    });
  }

  const newBooking = await bookingsService.rescheduleBooking(id, newStartTime, newEndTime, userId);

  res.status(200).json({
    success: true,
    message: 'Booking rescheduled successfully',
    data: newBooking
  });
});
