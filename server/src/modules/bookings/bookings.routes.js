const express = require('express');
const router = express.Router();
const bookingsController = require('./bookings.controller');

// TEMPORARY TEST ROUTE for Dev B (since Auth isn't ready)
router.get('/test/me', bookingsController.getTestUser);

// TEST ROUTE for 3B.9 (Simulate Maintenance Approval)
router.get('/test/maintenance/:assetId', (req, res) => {
  const eventBus = require('../../core/eventBus');
  eventBus.emit('entity.action', {
    type: 'maintenance.approved',
    actorName: 'Dev A (Tester)',
    entityType: 'maintenance',
    entityId: 'test-maint-1',
    data: { assetId: req.params.assetId }
  });
  res.json({ message: 'Maintenance approved event fired!' });
});

// 2B.2 - POST /api/bookings
router.post('/', bookingsController.createBooking);

// 2B.3 - GET /api/bookings
router.get('/', bookingsController.getBookings);

// 2B.4 - PUT /api/bookings/:id/cancel
router.put('/:id/cancel', bookingsController.cancelBooking);

// 2B.5 - PUT /api/bookings/:id/reschedule
router.put('/:id/reschedule', bookingsController.rescheduleBooking);

module.exports = router;
