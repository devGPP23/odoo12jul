/**
 * ActivityLog — MongoDB model.
 * Immutable audit trail: who did what, when, to which entity.
 * Shape varies by action type — that variability is why this lives in Mongo.
 */

const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: String,
      required: true,
      index: true,
    },
    actorName: String,
    actorRole: String,
    action: {
      type: String,
      required: true,
      // e.g. 'ASSET_CREATED', 'ALLOCATION_CREATED', 'TRANSFER_APPROVED', etc.
    },
    entityType: {
      type: String,
      required: true,
      enum: [
        'asset',
        'allocation',
        'booking',
        'maintenance',
        'transfer',
        'audit',
        'department',
        'employee',
        'asset_category',
      ],
    },
    entityId: {
      type: String,
      required: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ipAddress: String,
  },
  {
    timestamps: true,
  }
);

// Common queries: by actor, by entity, by time
activityLogSchema.index({ actorId: 1, createdAt: -1 });
activityLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
