/**
 * Bookings Module — Controller.
 */

const asyncHandler = require('../../utils/asyncHandler');
const bookingService = require('./service');

const create = asyncHandler(async (req, res) => {
  const booking = await bookingService.createBooking({
    ...req.body,
    bookedById: req.user.id,
  });
  res.locals.createdEntityId = booking.id;
  res.status(201).json({ success: true, data: booking });
});

const getAll = asyncHandler(async (req, res) => {
  const result = await bookingService.getBookings(req.query);
  res.json({ success: true, data: result });
});

const cancel = asyncHandler(async (req, res) => {
  const booking = await bookingService.cancelBooking(req.params.id, req.user.id);
  res.json({ success: true, data: booking });
});

const reschedule = asyncHandler(async (req, res) => {
  const booking = await bookingService.rescheduleBooking(
    req.params.id,
    req.body,
    req.user.id
  );
  res.json({ success: true, data: booking });
});

module.exports = { create, getAll, cancel, reschedule };
