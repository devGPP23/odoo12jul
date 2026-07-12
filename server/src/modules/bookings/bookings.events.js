const eventBus = require('../../core/eventBus');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 3B.9 - Jab kisi asset ka maintenance approve ho jaye
eventBus.on('entity.action', async (eventPayload) => {
  const { type, entityId, data } = eventPayload;

  // Sirf maintenance approve hone par chalega
  if (type === 'maintenance.approved') {
    try {
      const assetId = data?.assetId;
      if (!assetId) {
        console.log('Bhai assetId hi nahi mila maintenance event me');
        return;
      }

      console.log(`[Bookings Event] Maintenance approve hua asset ${assetId} ke liye. Bookings check kar rahe...`);

      // Wo saari bookings nikalo jo 'UPCOMING' ya 'ONGOING' hain
      const overlappingBookings = await prisma.booking.findMany({
        where: {
          assetId: assetId,
          status: { in: ['UPCOMING', 'ONGOING'] }
        },
        include: {
          bookedBy: { select: { id: true, name: true, email: true } }
        }
      });

      if (overlappingBookings.length === 0) {
        console.log('Koi overlapping booking nahi mili. Sab badhiya.');
        return;
      }

      // Sab overlapping bookings ko CANCEL kar do
      for (const booking of overlappingBookings) {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { status: 'CANCELLED' }
        });

        console.log(`[Bookings Event] Booking ${booking.id} CANCEL kardi gayi!`);

        // Ab user ko notification bhejna hai isliye event phek do
        const cancelKaData = {
          type: 'booking.cancelled',
          actorName: 'System (Maintenance)',
          entityType: 'booking',
          entityId: booking.id,
          data: {
            targetUserId: booking.bookedBy.id, // Kisko bhejna hai
            reason: 'Asset ko maintenance ke liye bhej diya gaya hai.'
          },
          timestamp: new Date().toISOString()
        };
        
        eventBus.emit('entity.action', cancelKaData);
      }
    } catch (err) {
      console.error('[Bookings Event] Maintenance check karte time error aaya:', err);
    }
  }
});
