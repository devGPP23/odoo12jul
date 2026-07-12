/**
 * Allocations Module — Service Layer.
 * The hardest logic in the app: double-allocation blocking via SELECT FOR UPDATE,
 * transfer workflow, return flow with condition check-in.
 */

const { prisma } = require('../../config/postgres');
const { transitionAssetStatus } = require('../assets/stateMachine');
const { sendNotification } = require('../notifications/notificationService');
const AppError = require('../../utils/AppError');

/**
 * Allocate an asset to an employee or department.
 * Uses SELECT ... FOR UPDATE to prevent race conditions.
 *
 * If already allocated → returns 409 with current holder info
 * (drives the "currently held by Priya" + Transfer Request UI).
 */
async function allocateAsset({
  assetId,
  employeeHolderId,
  departmentHolderId,
  expectedReturnDate,
  allocatedBy,
}) {
  // Validate holder: exactly one must be provided
  if (!employeeHolderId && !departmentHolderId) {
    throw new AppError('Either employeeHolderId or departmentHolderId is required.', 400);
  }
  if (employeeHolderId && departmentHolderId) {
    throw new AppError('Provide either employeeHolderId or departmentHolderId, not both.', 400);
  }

  return prisma.$transaction(async (tx) => {
    // SELECT FOR UPDATE — locks the asset row, preventing concurrent allocation
    const [asset] = await tx.$queryRaw`
      SELECT id, status, asset_tag, name
      FROM assets
      WHERE id = ${assetId}::uuid
      FOR UPDATE
    `;

    if (!asset) throw new AppError('Asset not found.', 404);

    if (asset.status !== 'AVAILABLE') {
      // If already allocated, find and return the current holder
      if (asset.status === 'ALLOCATED') {
        const currentAllocation = await tx.allocation.findFirst({
          where: { assetId, status: 'ACTIVE' },
          include: {
            employeeHolder: { select: { id: true, name: true, email: true } },
            departmentHolder: { select: { id: true, name: true } },
          },
        });

        throw new AppError(
          `Asset ${asset.asset_tag} is already allocated.`,
          409,
          {
            currentHolder: currentAllocation?.employeeHolder || currentAllocation?.departmentHolder,
            holderType: currentAllocation?.employeeHolder ? 'employee' : 'department',
            allocatedAt: currentAllocation?.allocatedAt,
            suggestTransfer: true,
          }
        );
      }

      throw new AppError(
        `Asset ${asset.asset_tag} is not available for allocation (current status: ${asset.status}).`,
        400
      );
    }

    // Create the allocation
    const allocation = await tx.allocation.create({
      data: {
        assetId,
        employeeHolderId: employeeHolderId || null,
        departmentHolderId: departmentHolderId || null,
        expectedReturnDate: expectedReturnDate ? new Date(expectedReturnDate) : null,
        status: 'ACTIVE',
      },
      include: {
        asset: { select: { id: true, assetTag: true, name: true } },
        employeeHolder: { select: { id: true, name: true } },
        departmentHolder: { select: { id: true, name: true } },
      },
    });

    // Transition asset status via state machine (inside the same transaction)
    await transitionAssetStatus(assetId, 'ALLOCATED', 'Allocation created', tx);

    // Fire-and-forget notification (AFTER transaction commits)
    const holderId = employeeHolderId || departmentHolderId;
    if (employeeHolderId) {
      setImmediate(() => {
        sendNotification({
          userId: employeeHolderId,
          type: 'ASSET_ASSIGNED',
          message: `Asset ${asset.asset_tag} (${asset.name}) has been assigned to you.`,
          relatedEntityId: allocation.id,
          relatedEntityType: 'allocation',
        });
      });
    }

    return allocation;
  });
}

/**
 * Return an asset — capture condition check-in notes, revert to Available.
 */
async function returnAsset(allocationId, { checkinNotes, condition }) {
  return prisma.$transaction(async (tx) => {
    const allocation = await tx.allocation.findUnique({
      where: { id: allocationId },
      include: {
        asset: { select: { id: true, assetTag: true, name: true } },
      },
    });

    if (!allocation) throw new AppError('Allocation not found.', 404);
    if (allocation.status !== 'ACTIVE') {
      throw new AppError('This allocation is not active.', 400);
    }

    // Update allocation
    const updated = await tx.allocation.update({
      where: { id: allocationId },
      data: {
        status: 'RETURNED',
        actualReturnDate: new Date(),
        checkinNotes: checkinNotes || null,
      },
      include: {
        asset: { select: { id: true, assetTag: true, name: true } },
        employeeHolder: { select: { id: true, name: true } },
        departmentHolder: { select: { id: true, name: true } },
      },
    });

    // Update asset condition if provided
    if (condition) {
      await tx.asset.update({
        where: { id: allocation.assetId },
        data: { condition },
      });
    }

    // Transition asset back to Available
    await transitionAssetStatus(allocation.assetId, 'AVAILABLE', 'Asset returned', tx);

    return updated;
  });
}

/**
 * Create a transfer request.
 */
async function createTransferRequest({ assetId, toHolderId, requestedById }) {
  // Find current allocation
  const currentAllocation = await prisma.allocation.findFirst({
    where: { assetId, status: 'ACTIVE' },
    include: {
      employeeHolder: { select: { id: true, name: true } },
    },
  });

  if (!currentAllocation) {
    throw new AppError('No active allocation found for this asset.', 404);
  }

  if (!currentAllocation.employeeHolderId) {
    throw new AppError('Transfers are only supported for employee-held assets.', 400);
  }

  // Check if target employee exists
  const toEmployee = await prisma.employee.findUnique({ where: { id: toHolderId } });
  if (!toEmployee) throw new AppError('Target employee not found.', 404);

  const transfer = await prisma.transferRequest.create({
    data: {
      assetId,
      fromHolderId: currentAllocation.employeeHolderId,
      toHolderId,
      requestedById,
      status: 'REQUESTED',
    },
    include: {
      asset: { select: { id: true, assetTag: true, name: true } },
      fromHolder: { select: { id: true, name: true } },
      toHolder: { select: { id: true, name: true } },
      requestedBy: { select: { id: true, name: true } },
    },
  });

  // Notify relevant parties
  setImmediate(() => {
    sendNotification({
      userId: currentAllocation.employeeHolderId,
      type: 'TRANSFER_REQUESTED',
      message: `Transfer requested for asset ${transfer.asset.assetTag} to ${transfer.toHolder.name}.`,
      relatedEntityId: transfer.id,
      relatedEntityType: 'transfer',
    });
  });

  return transfer;
}

/**
 * Approve a transfer — close old allocation, open new one, in one transaction.
 */
async function approveTransfer(transferId, approvedById) {
  return prisma.$transaction(async (tx) => {
    const transfer = await tx.transferRequest.findUnique({
      where: { id: transferId },
      include: {
        asset: { select: { id: true, assetTag: true, name: true } },
      },
    });

    if (!transfer) throw new AppError('Transfer request not found.', 404);
    if (transfer.status !== 'REQUESTED') {
      throw new AppError(`Transfer is already ${transfer.status}.`, 400);
    }

    // Close the current allocation
    await tx.allocation.updateMany({
      where: { assetId: transfer.assetId, status: 'ACTIVE' },
      data: {
        status: 'TRANSFERRED',
        actualReturnDate: new Date(),
      },
    });

    // Create new allocation for the recipient
    await tx.allocation.create({
      data: {
        assetId: transfer.assetId,
        employeeHolderId: transfer.toHolderId,
        status: 'ACTIVE',
      },
    });

    // Update transfer status
    const updated = await tx.transferRequest.update({
      where: { id: transferId },
      data: {
        status: 'APPROVED',
        approvedById,
      },
      include: {
        asset: { select: { id: true, assetTag: true, name: true } },
        fromHolder: { select: { id: true, name: true } },
        toHolder: { select: { id: true, name: true } },
      },
    });

    // Notifications
    setImmediate(() => {
      sendNotification({
        userId: transfer.toHolderId,
        type: 'TRANSFER_APPROVED',
        message: `Asset ${updated.asset.assetTag} has been transferred to you.`,
        relatedEntityId: transfer.id,
        relatedEntityType: 'transfer',
      });
      sendNotification({
        userId: transfer.fromHolderId,
        type: 'TRANSFER_APPROVED',
        message: `Asset ${updated.asset.assetTag} has been transferred to ${updated.toHolder.name}.`,
        relatedEntityId: transfer.id,
        relatedEntityType: 'transfer',
      });
    });

    return updated;
  });
}

/**
 * Reject a transfer request.
 */
async function rejectTransfer(transferId, approvedById) {
  const transfer = await prisma.transferRequest.findUnique({ where: { id: transferId } });
  if (!transfer) throw new AppError('Transfer request not found.', 404);
  if (transfer.status !== 'REQUESTED') {
    throw new AppError(`Transfer is already ${transfer.status}.`, 400);
  }

  const updated = await prisma.transferRequest.update({
    where: { id: transferId },
    data: { status: 'REJECTED', approvedById },
    include: {
      asset: { select: { id: true, assetTag: true, name: true } },
      requestedBy: { select: { id: true, name: true } },
    },
  });

  setImmediate(() => {
    sendNotification({
      userId: transfer.requestedById,
      type: 'TRANSFER_REJECTED',
      message: `Transfer request for asset ${updated.asset.assetTag} was rejected.`,
      relatedEntityId: transfer.id,
      relatedEntityType: 'transfer',
    });
  });

  return updated;
}

/**
 * Get all allocations with optional filters.
 */
async function getAllocations({ assetId, holderId, status, overdue, page = 1, limit = 50 } = {}) {
  const where = {};
  if (assetId) where.assetId = assetId;
  if (status) where.status = status;
  if (holderId) {
    where.OR = [
      { employeeHolderId: holderId },
      { departmentHolderId: holderId },
    ];
  }
  if (overdue === 'true') {
    where.status = 'ACTIVE';
    where.expectedReturnDate = { lt: new Date() };
    where.actualReturnDate = null;
  }

  const skip = (page - 1) * limit;

  const [allocations, total] = await Promise.all([
    prisma.allocation.findMany({
      where,
      include: {
        asset: { select: { id: true, assetTag: true, name: true, status: true } },
        employeeHolder: { select: { id: true, name: true, email: true } },
        departmentHolder: { select: { id: true, name: true } },
      },
      orderBy: { allocatedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.allocation.count({ where }),
  ]);

  return { allocations, total, page, limit, totalPages: Math.ceil(total / limit) };
}

/**
 * Get all transfer requests with optional filters.
 */
async function getTransfers({ assetId, status, page = 1, limit = 50 } = {}) {
  const where = {};
  if (assetId) where.assetId = assetId;
  if (status) where.status = status;

  const skip = (page - 1) * limit;

  const [transfers, total] = await Promise.all([
    prisma.transferRequest.findMany({
      where,
      include: {
        asset: { select: { id: true, assetTag: true, name: true } },
        fromHolder: { select: { id: true, name: true } },
        toHolder: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.transferRequest.count({ where }),
  ]);

  return { transfers, total, page, limit, totalPages: Math.ceil(total / limit) };
}

module.exports = {
  allocateAsset,
  returnAsset,
  createTransferRequest,
  approveTransfer,
  rejectTransfer,
  getAllocations,
  getTransfers,
};
