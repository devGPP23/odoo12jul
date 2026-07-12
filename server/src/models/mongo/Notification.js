/**
 * Notification — MongoDB model.
 * Schema-loose by design: different notification types carry different metadata.
 * Index on { userId, createdAt } for the common "recent for this user" query.
 */

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        'ASSET_ASSIGNED',
        'ASSET_RETURNED',
        'MAINTENANCE_APPROVED',
        'MAINTENANCE_REJECTED',
        'MAINTENANCE_RESOLVED',
        'BOOKING_CONFIRMED',
        'BOOKING_CANCELLED',
        'BOOKING_REMINDER',
        'TRANSFER_REQUESTED',
        'TRANSFER_APPROVED',
        'TRANSFER_REJECTED',
        'OVERDUE_RETURN',
        'AUDIT_ASSIGNED',
        'AUDIT_DISCREPANCY',
        'ROLE_PROMOTED',
        'GENERAL',
      ],
    },
    message: {
      type: String,
      required: true,
    },
    relatedEntityId: String,
    relatedEntityType: {
      type: String,
      enum: ['asset', 'allocation', 'booking', 'maintenance', 'transfer', 'audit', 'employee'],
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // createdAt + updatedAt
  }
);

// Compound index for the "recent notifications for user" query
notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
