const eventBus = require('../../core/eventBus');
const Notification = require('../../models/mongo/Notification');
const { getRedisPub } = require('../../config/redis');

  // YAR BACKEND SE JO BHI EVENT AAYEGI VO SAB MONGODB ME SAVE KARENGE
 // Event Handlers for Notifications
 // Listens to 'entity.action' from the eventBus and writes Mongo notifications.
 

// Mapping eventBus action types to Mongo Notification enum types
const ACTION_TO_NOTIFICATION_TYPE = {
  // YE SAB TYPE HAI KI KITNE NOTIFICATION AAYE HAI KAISE KAISE
  'asset.allocated': 'ASSET_ASSIGNED',
  'asset.returned': 'ASSET_RETURNED',
  'maintenance.approved': 'MAINTENANCE_APPROVED',
  'maintenance.rejected': 'MAINTENANCE_REJECTED',
  'maintenance.resolved': 'MAINTENANCE_RESOLVED',
  'booking.created': 'BOOKING_CONFIRMED',
  'booking.cancelled': 'BOOKING_CANCELLED',
  'booking.reminder': 'BOOKING_REMINDER',
  'transfer.requested': 'TRANSFER_REQUESTED',
  'transfer.approved': 'TRANSFER_APPROVED',
  'transfer.rejected': 'TRANSFER_REJECTED',
  'allocation.overdue': 'OVERDUE_RETURN',
  'audit.assigned': 'AUDIT_ASSIGNED',
  'audit.discrepancy': 'AUDIT_DISCREPANCY',
  'role.promoted': 'ROLE_PROMOTED',
};
// Sab Events ke liye main listener
eventBus.on('entity.action', async (eventPayload) => {
  try {
    const { type, actorName, entityType, entityId, relatedAssetId, data } = eventPayload;
    
    const notificationType = ACTION_TO_NOTIFICATION_TYPE[type] || 'GENERAL';
    
    // Determine who should receive the notification based on event data
    // (Dev A's modules should ideally pass targetUserId in data)
    const targetUserId = data?.targetUserId || data?.employeeId || data?.userId;
    
    if (!targetUserId) {
      // If we can't figure out who to notify, we might log it or skip
      // In a real app, some events go to Admins or Dept Heads
      console.warn(`[Notification Handler] No targetUserId found for event: ${type}`);
      return; 
    }

    // Generate a human-readable message
    let message = `Action performed: ${type} by ${actorName}`;
    switch(notificationType) {
      case 'ASSET_ASSIGNED':
        message = `An asset has been allocated to you by ${actorName}.`;
        break;
      case 'ASSET_RETURNED':
        message = `Asset return acknowledged.`;
        break;
      case 'MAINTENANCE_APPROVED':
        message = `Your maintenance request has been approved.`;
        break;
      case 'BOOKING_CONFIRMED':
        message = `Your booking has been confirmed.`;
        break;
      case 'TRANSFER_REQUESTED':
        message = `${actorName} has requested an asset transfer.`;
        break;
      case 'OVERDUE_RETURN':
        message = `Reminder: An asset you hold is overdue for return.`;
        break;
      // fallback handled by default initialization
    }

    // Create Notification in MongoDB
    const nayaNotification = await Notification.create({
      userId: String(targetUserId),
      type: notificationType,
      message,
      relatedEntityId: String(entityId),
      relatedEntityType: entityType,
      metadata: data || {}
    });

    console.log(`[Notification Handler] MongoDB me save ho gaya for ${type}`);

    // Redis Pub/Sub ke zariye Socket.io tak bhejo (Real-time push)
    try {
      const pub = getRedisPub();
      if (pub) {
        pub.publish(`notifications:${targetUserId}`, JSON.stringify(nayaNotification));
        console.log(`[Notification Handler] Redis channel pe bhej diya: notifications:${targetUserId}`);
      }
    } catch (redisErr) {
      console.error('[Notification Handler] Redis publish fail ho gaya bhai:', redisErr);
    }

  } catch (err) {
    console.error('[Notification Handler] Error saving notification:', err);
  }
});
