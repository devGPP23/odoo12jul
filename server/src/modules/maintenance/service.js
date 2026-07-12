/**
 * Maintenance Module — Service Layer.
 * Workflow: Pending → Approved/Rejected → Technician Assigned → In Progress → Resolved.
 * Only approval flips asset to Under Maintenance. Rejection does NOT change asset status.
 */

const { prisma } = require('../../config/postgres');
const { transitionAssetStatus } = require('../assets/stateMachine');
const { sendNotification } = require('../notifications/notificationService');
const AppError = require('../../utils/AppError');

/**
 * Raise a maintenance request.
 */
async function raiseRequest({ assetId, raisedById, issueDescription, priority, photoUrl }) {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { id: true, assetTag: true, name: true, status: true },
  });

  if (!asset) throw new AppError('Asset not found.', 404);

  if (['DISPOSED', 'LOST'].includes(asset.status)) {
    throw new AppError(
      `Cannot raise maintenance for an asset with status '${asset.status}'.`,
      400
    );
  }

  return prisma.maintenanceRequest.create({
    data: {
      assetId,
      raisedById,
      issueDescription,
      priority: priority || 'MEDIUM',
      photoUrl: photoUrl || null,
      status: 'PENDING',
    },
    include: {
      asset: { select: { id: true, assetTag: true, name: true } },
      raisedBy: { select: { id: true, name: true } },
    },
  });
}

/**
 * Approve a maintenance request.
 * This is the ONLY action that flips asset status to UNDER_MAINTENANCE.
 */
async function approveRequest(requestId, approvedById) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.maintenanceRequest.findUnique({
      where: { id: requestId },
      include: { asset: { select: { id: true, assetTag: true, name: true } } },
    });

    if (!request) throw new AppError('Maintenance request not found.', 404);
    if (request.status !== 'PENDING') {
      throw new AppError(`Request is already ${request.status}.`, 400);
    }

    // Flip asset to Under Maintenance via state machine
    await transitionAssetStatus(
      request.assetId,
      'UNDER_MAINTENANCE',
      `Maintenance approved (request ${requestId})`,
      tx
    );

    const updated = await tx.maintenanceRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        approvedById,
      },
      include: {
        asset: { select: { id: true, assetTag: true, name: true } },
        raisedBy: { select: { id: true, name: true } },
      },
    });

    // Notify the requester
    setImmediate(() => {
      sendNotification({
        userId: request.raisedById,
        type: 'MAINTENANCE_APPROVED',
        message: `Maintenance request for ${updated.asset.assetTag} has been approved.`,
        relatedEntityId: requestId,
        relatedEntityType: 'maintenance',
      });
    });

    return updated;
  });
}

/**
 * Reject a maintenance request. Does NOT change asset status.
 */
async function rejectRequest(requestId, approvedById) {
  const request = await prisma.maintenanceRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new AppError('Maintenance request not found.', 404);
  if (request.status !== 'PENDING') {
    throw new AppError(`Request is already ${request.status}.`, 400);
  }

  const updated = await prisma.maintenanceRequest.update({
    where: { id: requestId },
    data: { status: 'REJECTED', approvedById },
    include: {
      asset: { select: { id: true, assetTag: true, name: true } },
    },
  });

  setImmediate(() => {
    sendNotification({
      userId: request.raisedById,
      type: 'MAINTENANCE_REJECTED',
      message: `Maintenance request for ${updated.asset.assetTag} has been rejected.`,
      relatedEntityId: requestId,
      relatedEntityType: 'maintenance',
    });
  });

  return updated;
}

/**
 * Assign a technician to an approved request.
 */
async function assignTechnician(requestId, technicianId) {
  const request = await prisma.maintenanceRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new AppError('Maintenance request not found.', 404);
  if (request.status !== 'APPROVED') {
    throw new AppError('Can only assign technician to approved requests.', 400);
  }

  const technician = await prisma.employee.findUnique({ where: { id: technicianId } });
  if (!technician) throw new AppError('Technician not found.', 404);

  return prisma.maintenanceRequest.update({
    where: { id: requestId },
    data: { status: 'TECHNICIAN_ASSIGNED', technicianId },
    include: {
      asset: { select: { id: true, assetTag: true, name: true } },
      technician: { select: { id: true, name: true } },
    },
  });
}

/**
 * Mark request as in progress.
 */
async function startProgress(requestId) {
  const request = await prisma.maintenanceRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new AppError('Maintenance request not found.', 404);
  if (request.status !== 'TECHNICIAN_ASSIGNED') {
    throw new AppError('Technician must be assigned before starting work.', 400);
  }

  return prisma.maintenanceRequest.update({
    where: { id: requestId },
    data: { status: 'IN_PROGRESS' },
  });
}

/**
 * Resolve a maintenance request. Flips asset back to Available.
 */
async function resolveRequest(requestId) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.maintenanceRequest.findUnique({
      where: { id: requestId },
      include: { asset: { select: { id: true, assetTag: true } } },
    });

    if (!request) throw new AppError('Maintenance request not found.', 404);
    if (!['TECHNICIAN_ASSIGNED', 'IN_PROGRESS'].includes(request.status)) {
      throw new AppError('Can only resolve requests that are assigned or in progress.', 400);
    }

    // Flip asset back to Available
    await transitionAssetStatus(
      request.assetId,
      'AVAILABLE',
      `Maintenance resolved (request ${requestId})`,
      tx
    );

    const updated = await tx.maintenanceRequest.update({
      where: { id: requestId },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
      include: {
        asset: { select: { id: true, assetTag: true, name: true } },
        raisedBy: { select: { id: true, name: true } },
      },
    });

    setImmediate(() => {
      sendNotification({
        userId: request.raisedById,
        type: 'MAINTENANCE_RESOLVED',
        message: `Maintenance for ${updated.asset.assetTag} has been resolved.`,
        relatedEntityId: requestId,
        relatedEntityType: 'maintenance',
      });
    });

    return updated;
  });
}

/**
 * Get all maintenance requests with optional filters.
 */
async function getRequests({ assetId, status, priority, raisedById, page = 1, limit = 50 } = {}) {
  const where = {};
  if (assetId) where.assetId = assetId;
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (raisedById) where.raisedById = raisedById;

  const skip = (page - 1) * limit;

  const [requests, total] = await Promise.all([
    prisma.maintenanceRequest.findMany({
      where,
      include: {
        asset: { select: { id: true, assetTag: true, name: true, status: true } },
        raisedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        technician: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.maintenanceRequest.count({ where }),
  ]);

  return { requests, total, page, limit, totalPages: Math.ceil(total / limit) };
}

module.exports = {
  raiseRequest,
  approveRequest,
  rejectRequest,
  assignTechnician,
  startProgress,
  resolveRequest,
  getRequests,
};
