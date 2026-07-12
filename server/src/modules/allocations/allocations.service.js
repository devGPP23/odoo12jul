const { prisma } = require('../../config/postgres');
const AppError = require('../../utils/AppError');
const eventBus = require('../../core/eventBus');
const { transitionAssetStatus } = require('../../core/assetStateMachine');

class AllocationsService {
  /**
   * 2A.1: Allocate an asset to an employee or a department.
   * Uses SELECT FOR UPDATE inside a transaction and a partial unique index safety net.
   */
  async allocate(data) {
    const { assetId, employeeHolderId, departmentHolderId, expectedReturnDate } = data;

    // Check that exactly one holder is provided (polymorphic relation constraint check)
    if (!employeeHolderId && !departmentHolderId) {
      throw new AppError('Either employeeHolderId or departmentHolderId must be provided.', 400);
    }
    if (employeeHolderId && departmentHolderId) {
      throw new AppError('An asset cannot be allocated to both an employee and a department.', 400);
    }

    try {
      return await prisma.$transaction(async (tx) => {
        // 2A.1: SELECT ... FOR UPDATE row lock inside the transaction
        const assets = await tx.$queryRaw`
          SELECT id, status, is_bookable AS "isBookable", name, asset_tag AS "assetTag"
          FROM assets
          WHERE id = ${assetId}
          FOR UPDATE
        `;

        if (assets.length === 0) {
          throw new AppError('Asset not found.', 404);
        }

        const asset = assets[0];

        // Checks asset.status = 'AVAILABLE'
        if (asset.status !== 'AVAILABLE') {
          // Find the active allocation of this asset to return details for the 409 response
          const activeAllocation = await tx.allocation.findFirst({
            where: {
              assetId: assetId,
              status: 'ACTIVE'
            },
            include: {
              employeeHolder: {
                select: {
                  name: true,
                  department: { select: { name: true } }
                }
              },
              departmentHolder: { select: { name: true } }
            }
          });

          const currentHolder = activeAllocation?.employeeHolder?.name || activeAllocation?.departmentHolder?.name || 'Unknown';
          const department = activeAllocation?.employeeHolder?.department?.name || activeAllocation?.departmentHolder?.name || 'Unknown';
          const allocatedSince = activeAllocation?.allocatedAt || null;

          throw new AppError('Asset currently allocated or not available.', 409, {
            currentHolder,
            department,
            allocatedSince,
            transferRequestUrl: '/api/transfers'
          });
        }

        // Create the new active allocation record
        const allocation = await tx.allocation.create({
          data: {
            assetId,
            employeeHolderId,
            departmentHolderId,
            expectedReturnDate: expectedReturnDate ? new Date(expectedReturnDate) : null,
            status: 'ACTIVE'
          }
        });

        // central transition status call
        await transitionAssetStatus(assetId, 'ALLOCATED', 'Asset allocated successfully', tx);

        return { allocation, asset };
      }).then(async (result) => {
        // Emit events after Postgres commits successfully
        eventBus.emit('entity.action', {
          type: 'asset.allocated',
          entityType: 'allocation',
          entityId: result.allocation.id,
          relatedAssetId: result.asset.id,
          data: {
            assetTag: result.asset.assetTag,
            employeeHolderId,
            departmentHolderId
          },
          timestamp: new Date().toISOString()
        });

        return result.allocation;
      });
    } catch (err) {
      // Partial unique index idx_one_active_allocation (migration: allocation_active_unique) is the DB safety net.
      if (err.code === 'P2002') {
        throw new AppError('Conflict: This asset already has an active allocation.', 409);
      }
      throw err;
    }
  }

  /**
   * 2A.3: Return allocation flow.
   */
  async returnAllocation(id, data) {
    const { condition, notes } = data;

    return prisma.$transaction(async (tx) => {
      const allocation = await tx.allocation.findUnique({
        where: { id }
      });

      if (!allocation) {
        throw new AppError('Allocation not found', 404);
      }

      if (allocation.status !== 'ACTIVE') {
        throw new AppError('Allocation is not active', 400);
      }

      // Close the allocation
      const updatedAllocation = await tx.allocation.update({
        where: { id },
        data: {
          status: 'RETURNED',
          actualReturnDate: new Date(),
          checkinNotes: notes || null
        }
      });

      // Update asset condition if provided
      if (condition) {
        await tx.asset.update({
          where: { id: allocation.assetId },
          data: { condition }
        });
      }

      // transitionAssetStatus -> AVAILABLE
      const updatedAsset = await transitionAssetStatus(allocation.assetId, 'AVAILABLE', 'Asset returned', tx);

      return { updatedAllocation, updatedAsset };
    }).then((result) => {
      eventBus.emit('entity.action', {
        type: 'asset.returned',
        entityType: 'allocation',
        entityId: result.updatedAllocation.id,
        relatedAssetId: result.updatedAsset.id,
        data: {
          assetTag: result.updatedAsset.assetTag,
          condition,
          notes
        },
        timestamp: new Date().toISOString()
      });

      const suggestMaintenance = condition?.toUpperCase() === 'DAMAGED';

      return {
        allocation: result.updatedAllocation,
        suggestMaintenance
      };
    });
  }

  /**
   * 2A.4: Create transfer request
   */
  async createTransferRequest(data) {
    const { assetId, fromHolderId, toHolderId, requestedById } = data;

    if (toHolderId === fromHolderId) {
      throw new AppError('Cannot transfer to the same user', 400);
    }

    const asset = await prisma.asset.findUnique({
      where: { id: assetId }
    });

    if (!asset) {
      throw new AppError('Asset not found', 404);
    }

    if (asset.status === 'UNDER_MAINTENANCE') {
      throw new AppError('Asset under maintenance cannot be transferred', 400);
    }

    if (asset.status !== 'ALLOCATED') {
      throw new AppError('Asset is not currently allocated', 400);
    }

    // Verify that fromHolder actually holds the asset
    const activeAllocation = await prisma.allocation.findFirst({
      where: {
        assetId,
        status: 'ACTIVE',
        employeeHolderId: fromHolderId
      }
    });

    if (!activeAllocation) {
      throw new AppError('The asset is not currently allocated to the specified user', 400);
    }

    const transferRequest = await prisma.transferRequest.create({
      data: {
        assetId,
        fromHolderId,
        toHolderId,
        requestedById,
        status: 'REQUESTED'
      }
    });

    eventBus.emit('entity.action', {
      type: 'transfer.requested',
      entityType: 'transfer_request',
      entityId: transferRequest.id,
      relatedAssetId: assetId,
      data: {
        fromHolderId,
        toHolderId,
        requestedById
      },
      timestamp: new Date().toISOString()
    });

    return transferRequest;
  }

  /**
   * 2A.5: Approve transfer request
   */
  async approveTransferRequest(id, approvedById) {
    return prisma.$transaction(async (tx) => {
      const transferRequest = await tx.transferRequest.findUnique({
        where: { id }
      });

      if (!transferRequest) {
        throw new AppError('Transfer request not found', 404);
      }

      if (transferRequest.status !== 'REQUESTED') {
        throw new AppError(`Transfer request is already ${transferRequest.status}`, 400);
      }

      // AL6 edge case: Re-check that the allocation status is still ACTIVE before approving
      const activeAllocation = await tx.allocation.findFirst({
        where: {
          assetId: transferRequest.assetId,
          status: 'ACTIVE',
          employeeHolderId: transferRequest.fromHolderId
        }
      });

      if (!activeAllocation) {
        throw new AppError('The original allocation is no longer active, transfer cannot be completed', 400);
      }

      // 1. Close old allocation
      await tx.allocation.update({
        where: { id: activeAllocation.id },
        data: {
          status: 'TRANSFERRED',
          actualReturnDate: new Date(),
          checkinNotes: `Transferred to employee ${transferRequest.toHolderId}`
        }
      });

      // 2. Open new allocation
      const newAllocation = await tx.allocation.create({
        data: {
          assetId: transferRequest.assetId,
          employeeHolderId: transferRequest.toHolderId,
          status: 'ACTIVE'
        }
      });

      // 3. Update Transfer Request status
      const updatedTransferRequest = await tx.transferRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedById
        }
      });

      return { updatedTransferRequest, newAllocation };
    }).then((result) => {
      eventBus.emit('entity.action', {
        type: 'transfer.approved',
        entityType: 'transfer_request',
        entityId: result.updatedTransferRequest.id,
        relatedAssetId: result.updatedTransferRequest.assetId,
        data: {
          newAllocationId: result.newAllocation.id,
          fromHolderId: result.updatedTransferRequest.fromHolderId,
          toHolderId: result.updatedTransferRequest.toHolderId
        },
        timestamp: new Date().toISOString()
      });

      return result.updatedTransferRequest;
    });
  }

  /**
   * 2A.6: Reject transfer request
   */
  async rejectTransferRequest(id, rejectedById) {
    const transferRequest = await prisma.transferRequest.findUnique({
      where: { id }
    });

    if (!transferRequest) {
      throw new AppError('Transfer request not found', 404);
    }

    if (transferRequest.status !== 'REQUESTED') {
      throw new AppError(`Transfer request is already ${transferRequest.status}`, 400);
    }

    const updatedTransferRequest = await prisma.transferRequest.update({
      where: { id },
      data: {
        status: 'REJECTED'
      }
    });

    eventBus.emit('entity.action', {
      type: 'transfer.rejected',
      entityType: 'transfer_request',
      entityId: updatedTransferRequest.id,
      relatedAssetId: updatedTransferRequest.assetId,
      data: {
        rejectedById
      },
      timestamp: new Date().toISOString()
    });

    return updatedTransferRequest;
  }
}

module.exports = new AllocationsService();
