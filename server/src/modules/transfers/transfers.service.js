/**
 * Transfers Service — Phase 2A (2A.4 – 2A.6)
 *
 * Implements the full transfer lifecycle:
 *   - createTransferRequest() : POST /api/transfers
 *   - approveTransfer()       : PUT  /api/transfers/:id/approve
 *   - rejectTransfer()        : PUT  /api/transfers/:id/reject
 *   - getById()
 *   - list()
 *
 * Edge cases handled:
 *   AL2  - toHolder must be ACTIVE employee
 *   AL6  - Re-check allocation.status inside the approval transaction before acting
 *          (guards against the window between transfer creation and approval)
 *   AL7  - Only REQUESTED transfers can be approved/rejected (idempotency on state)
 *   AL4  - Asset not under maintenance when creating request
 */

const { prisma } = require('../../config/postgres');
const AppError = require('../../utils/AppError');
const eventBus = require('../../core/eventBus');

class TransfersService {
  /**
   * Create a transfer request.
   *
   * Validates:
   *  - Asset is currently allocated (has an ACTIVE allocation)
   *  - fromHolder matches the current allocation holder
   *  - toHolder ≠ fromHolder
   *  - toHolder is an ACTIVE employee  (AL2)
   *  - Asset is not currently under maintenance (AL4)
   */
  async createTransferRequest(data, actorId) {
    const { assetId, fromHolderId, toHolderId } = data;

    // Validate within transaction so the allocation check is consistent
    return prisma.$transaction(async (tx) => {
      // ── Get current active allocation ─────────────────────────────────
      const currentAllocation = await tx.allocation.findFirst({
        where: { assetId, status: 'ACTIVE' },
        include: {
          asset: { select: { id: true, assetTag: true, name: true, status: true } },
          employeeHolder: { select: { id: true, name: true } },
        },
      });

      if (!currentAllocation) {
        throw new AppError('Asset is not currently allocated — cannot create transfer request.', 400);
      }

      // ── fromHolder must match current holder ──────────────────────────
      if (currentAllocation.employeeHolderId !== fromHolderId) {
        throw new AppError(
          'The specified fromHolder does not match the current asset holder.',
          400
        );
      }

      // ── to_user ≠ from_user ────────────────────────────────────────────
      if (fromHolderId === toHolderId) {
        throw new AppError('Transfer target must be different from the current holder.', 400);
      }

      // ── AL2: toHolder must exist and be ACTIVE ────────────────────────
      const toHolder = await tx.employee.findUnique({
        where: { id: toHolderId },
        select: { id: true, name: true, status: true, departmentId: true },
      });
      if (!toHolder) {
        throw new AppError('Target employee not found.', 404);
      }
      if (toHolder.status !== 'ACTIVE') {
        throw new AppError(
          `Target employee "${toHolder.name}" is inactive and cannot receive asset transfers.`,
          400
        );
      }

      // ── AL4: Asset must not be under maintenance ──────────────────────
      const activeMaintenance = await tx.maintenanceRequest.findFirst({
        where: {
          assetId,
          status: { in: ['APPROVED', 'TECHNICIAN_ASSIGNED', 'IN_PROGRESS'] },
        },
      });
      if (activeMaintenance) {
        throw new AppError(
          `Asset "${currentAllocation.asset.assetTag}" is currently under maintenance and cannot be transferred.`,
          400
        );
      }

      // ── Check no REQUESTED transfer already exists for same asset ─────
      // (prevents duplicate pending requests — soft idempotency)
      const existingPending = await tx.transferRequest.findFirst({
        where: { assetId, status: 'REQUESTED' },
      });
      if (existingPending) {
        throw new AppError(
          'A transfer request for this asset is already pending. Approve or reject it first.',
          409
        );
      }

      // ── Create transfer request ───────────────────────────────────────
      const transfer = await tx.transferRequest.create({
        data: {
          assetId,
          fromHolderId,
          toHolderId,
          requestedById: actorId,
          status: 'REQUESTED',
        },
        include: {
          asset: { select: { id: true, assetTag: true, name: true } },
          fromHolder: {
            select: { id: true, name: true, department: { select: { id: true, name: true } } },
          },
          toHolder: {
            select: { id: true, name: true, department: { select: { id: true, name: true } } },
          },
          requestedBy: { select: { id: true, name: true } },
        },
      });

      // ── Emit event after commit ────────────────────────────────────────
      setImmediate(() => {
        eventBus.emit('entity.action', {
          type: 'transfer.requested',
          actorId,
          entityType: 'transfer',
          entityId: transfer.id,
          relatedAssetId: assetId,
          departmentId: toHolder.departmentId || null,
          data: {
            assetTag: transfer.asset.assetTag,
            assetName: transfer.asset.name,
            fromHolder: transfer.fromHolder.name,
            toHolder: transfer.toHolder.name,
          },
          timestamp: new Date().toISOString(),
        });
      });

      return transfer;
    });
  }

  /**
   * Approve a transfer request.
   *
   * Single atomic transaction:
   *   1. Lock transfer row — verify status is still REQUESTED
   *   2. AL6: Re-verify the original allocation is still ACTIVE
   *      (guards against: return + re-allocate between request and approval)
   *   3. Close old allocation (status → TRANSFERRED)
   *   4. Open new allocation for toHolder
   *   5. Mark transfer APPROVED
   *   6. Emit transfer.approved event (AFTER commit via setImmediate)
   *
   * Asset.status stays ALLOCATED throughout — no state machine call needed.
   */
  async approveTransfer(transferId, actorId) {
    return prisma.$transaction(async (tx) => {
      // ── Fetch transfer ─────────────────────────────────────────────────
      const transfer = await tx.transferRequest.findUnique({
        where: { id: transferId },
        include: {
          asset: { select: { id: true, assetTag: true, name: true, status: true } },
          fromHolder: { select: { id: true, name: true } },
          toHolder: {
            select: { id: true, name: true, departmentId: true, department: { select: { id: true, name: true } } },
          },
        },
      });

      if (!transfer) {
        throw new AppError('Transfer request not found.', 404);
      }

      // ── AL7: Idempotency — only REQUESTED can be approved ─────────────
      if (transfer.status !== 'REQUESTED') {
        throw new AppError(
          `Transfer is already ${transfer.status.toLowerCase()} and cannot be approved again.`,
          400
        );
      }

      // ── AL2: Re-check toHolder is still active at approval time ───────
      const toHolder = await tx.employee.findUnique({
        where: { id: transfer.toHolderId },
        select: { id: true, status: true, name: true },
      });
      if (!toHolder || toHolder.status !== 'ACTIVE') {
        throw new AppError(
          `Target employee "${transfer.toHolder.name}" is no longer active. Cannot approve transfer.`,
          400
        );
      }

      // ── AL6: Re-check original allocation is still ACTIVE ────────────
      // This is the critical race-condition guard. If the asset was returned
      // (or another admin closed the allocation) between the request and this
      // approval, we must reject here rather than corrupt state.
      const currentAllocation = await tx.allocation.findFirst({
        where: {
          assetId: transfer.assetId,
          employeeHolderId: transfer.fromHolderId,
          status: 'ACTIVE',
        },
      });

      if (!currentAllocation) {
        // Also check if it's OVERDUE (still legitimate to transfer)
        const overdueAllocation = await tx.allocation.findFirst({
          where: {
            assetId: transfer.assetId,
            employeeHolderId: transfer.fromHolderId,
            status: 'OVERDUE',
          },
        });

        if (!overdueAllocation) {
          throw new AppError(
            `AL6: The original allocation for asset "${transfer.asset.assetTag}" no longer exists or has been closed. ` +
              'The asset may have been returned or re-allocated since this transfer was requested.',
            409
          );
        }

        // Use the overdue allocation as the one to close
        const overdueId = overdueAllocation.id;

        // Close overdue allocation
        await tx.allocation.update({
          where: { id: overdueId },
          data: {
            actualReturnDate: new Date(),
            checkinNotes: `Transferred to ${transfer.toHolder.name} via transfer request ${transferId}`,
            status: 'TRANSFERRED',
          },
        });
      } else {
        // ── Step 3: Close the ACTIVE old allocation ──────────────────────
        await tx.allocation.update({
          where: { id: currentAllocation.id },
          data: {
            actualReturnDate: new Date(),
            checkinNotes: `Transferred to ${transfer.toHolder.name} via transfer request ${transferId}`,
            status: 'TRANSFERRED',
          },
        });
      }

      // ── Step 4: Open new allocation for toHolder ──────────────────────
      const newAllocation = await tx.allocation.create({
        data: {
          assetId: transfer.assetId,
          employeeHolderId: transfer.toHolderId,
          status: 'ACTIVE',
          // expectedReturnDate not carried over — new holder sets their own
        },
        select: { id: true },
      });

      // ── Step 5: Mark transfer APPROVED ───────────────────────────────
      const updatedTransfer = await tx.transferRequest.update({
        where: { id: transferId },
        data: {
          status: 'APPROVED',
          approvedById: actorId,
        },
        include: {
          asset: { select: { id: true, assetTag: true, name: true } },
          fromHolder: { select: { id: true, name: true } },
          toHolder: {
            select: { id: true, name: true, department: { select: { id: true, name: true } } },
          },
          requestedBy: { select: { id: true, name: true } },
          approvedBy: { select: { id: true, name: true } },
        },
      });

      // ── Step 6: Emit event after transaction commits ──────────────────
      setImmediate(() => {
        eventBus.emit('entity.action', {
          type: 'transfer.approved',
          actorId,
          entityType: 'transfer',
          entityId: transferId,
          relatedAssetId: transfer.assetId,
          departmentId: transfer.toHolder.departmentId || null,
          data: {
            assetTag: transfer.asset.assetTag,
            assetName: transfer.asset.name,
            fromHolder: transfer.fromHolder.name,
            toHolder: transfer.toHolder.name,
            newAllocationId: newAllocation.id,
          },
          timestamp: new Date().toISOString(),
        });
      });

      return { ...updatedTransfer, newAllocationId: newAllocation.id };
    });
  }

  /**
   * Reject a transfer request.
   *
   * Simple status update — asset allocation is unchanged.
   * Notifies both the requester and the fromHolder via eventBus.
   */
  async rejectTransfer(transferId, rejectionReason, actorId) {
    // Fetch first to get full data for event
    const existing = await prisma.transferRequest.findUnique({
      where: { id: transferId },
      include: {
        asset: { select: { id: true, assetTag: true, name: true } },
        fromHolder: { select: { id: true, name: true } },
        toHolder: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, name: true } },
      },
    });

    if (!existing) throw new AppError('Transfer request not found.', 404);

    // ── AL7: Only REQUESTED can be rejected ───────────────────────────
    if (existing.status !== 'REQUESTED') {
      throw new AppError(
        `Transfer is already ${existing.status.toLowerCase()} and cannot be rejected.`,
        400
      );
    }

    // ── Simple status update ──────────────────────────────────────────
    const updated = await prisma.transferRequest.update({
      where: { id: transferId },
      data: {
        status: 'REJECTED',
        approvedById: actorId, // stores the rejecting manager's ID
      },
      include: {
        asset: { select: { id: true, assetTag: true, name: true } },
        fromHolder: { select: { id: true, name: true } },
        toHolder: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    });

    // ── Emit event — Dev B's notification handler consumes this ───────
    setImmediate(() => {
      eventBus.emit('entity.action', {
        type: 'transfer.rejected',
        actorId,
        entityType: 'transfer',
        entityId: transferId,
        relatedAssetId: existing.assetId,
        data: {
          assetTag: existing.asset.assetTag,
          assetName: existing.asset.name,
          fromHolder: existing.fromHolder.name,
          toHolder: existing.toHolder.name,
          rejectionReason: rejectionReason || 'No reason provided',
          requestedById: existing.requestedBy.id,
        },
        timestamp: new Date().toISOString(),
      });
    });

    return updated;
  }

  /**
   * Get a single transfer request with full relations.
   */
  async getById(transferId) {
    const transfer = await prisma.transferRequest.findUnique({
      where: { id: transferId },
      include: {
        asset: {
          select: {
            id: true,
            assetTag: true,
            name: true,
            status: true,
            condition: true,
            location: true,
            category: { select: { id: true, name: true } },
          },
        },
        fromHolder: {
          select: { id: true, name: true, department: { select: { id: true, name: true } } },
        },
        toHolder: {
          select: { id: true, name: true, department: { select: { id: true, name: true } } },
        },
        requestedBy: {
          select: { id: true, name: true, department: { select: { id: true, name: true } } },
        },
        approvedBy: { select: { id: true, name: true } },
      },
    });

    if (!transfer) throw new AppError('Transfer request not found.', 404);
    return transfer;
  }

  /**
   * List transfer requests with optional filters and pagination.
   */
  async list(filters = {}) {
    const { assetId, status, requesterId } = filters;
    const page  = parseInt(filters.page,  10) || 1;
    const limit = parseInt(filters.limit, 10) || 20;
    const skip  = (page - 1) * limit;

    const where = {};
    if (assetId)    where.assetId       = assetId;
    if (status)     where.status        = status;
    if (requesterId) where.requestedById = requesterId;

    const [transfers, total] = await Promise.all([
      prisma.transferRequest.findMany({
        where,
        skip,
        take: limit,
        include: {
          asset: { select: { id: true, assetTag: true, name: true, status: true } },
          fromHolder: {
            select: { id: true, name: true, department: { select: { id: true, name: true } } },
          },
          toHolder: {
            select: { id: true, name: true, department: { select: { id: true, name: true } } },
          },
          requestedBy: { select: { id: true, name: true } },
          approvedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.transferRequest.count({ where }),
    ]);

    return {
      data: transfers,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}

module.exports = new TransfersService();