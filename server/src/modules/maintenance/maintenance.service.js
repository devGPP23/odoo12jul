const { prisma } = require('../../config/postgres');
const AppError = require('../../utils/AppError');
const eventBus = require('../../core/eventBus');
const { transitionAssetStatus } = require('../../core/assetStateMachine');

class MaintenanceService {
  /**
   * 3A.1: Raise maintenance request.
   * Validate: asset not disposed/retired, no active request for same asset (M1),
   * holder can raise for own asset only (unless they are ADMIN or ASSET_MANAGER).
   */
  async raiseRequest(data) {
    const { assetId, raisedById, issueDescription, priority, photoUrl } = data;

    const [asset, employee] = await Promise.all([
      prisma.asset.findUnique({ where: { id: assetId } }),
      prisma.employee.findUnique({ where: { id: raisedById } })
    ]);

    if (!asset) {
      throw new AppError('Asset not found.', 404);
    }
    if (!employee) {
      throw new AppError('Employee not found.', 404);
    }

    // 1. Asset not disposed/retired
    if (['DISPOSED', 'RETIRED'].includes(asset.status)) {
      throw new AppError(`Cannot raise maintenance request for a ${asset.status.toLowerCase()} asset.`, 400);
    }

    // 2. No active request for same asset (M1)
    const activeRequest = await prisma.maintenanceRequest.findFirst({
      where: {
        assetId,
        status: {
          notIn: ['RESOLVED', 'REJECTED']
        }
      }
    });

    if (activeRequest) {
      throw new AppError('Asset already has an active maintenance request.', 400);
    }

    // 3. Holder can raise for own asset only
    if (employee.role !== 'ADMIN' && employee.role !== 'ASSET_MANAGER') {
      const activeAllocation = await prisma.allocation.findFirst({
        where: {
          assetId,
          status: 'ACTIVE',
          employeeHolderId: raisedById
        }
      });

      if (!activeAllocation) {
        throw new AppError('You can only raise maintenance requests for assets currently allocated to you.', 403);
      }
    }

    const request = await prisma.maintenanceRequest.create({
      data: {
        assetId,
        raisedById,
        issueDescription,
        priority: priority || 'MEDIUM',
        photoUrl: photoUrl || null,
        status: 'PENDING'
      },
      include: {
        asset: { select: { id: true, assetTag: true, name: true } },
        raisedBy: { select: { id: true, name: true, email: true } }
      }
    });

    eventBus.emit('entity.action', {
      type: 'maintenance.created',
      entityType: 'maintenance',
      entityId: request.id,
      relatedAssetId: assetId,
      data: {
        assetTag: request.asset.assetTag,
        raisedBy: request.raisedBy.name
      },
      timestamp: new Date().toISOString()
    });

    return request;
  }

  /**
   * 3A.2: Approve maintenance request
   * Save asset.status as previous_asset_status, transitionAssetStatus -> UNDER_MAINTENANCE
   */
  async approveRequest(id, approvedById) {
    return prisma.$transaction(async (tx) => {
      const request = await tx.maintenanceRequest.findUnique({
        where: { id },
        include: { asset: { select: { id: true, status: true, assetTag: true } } }
      });

      if (!request) {
        throw new AppError('Maintenance request not found.', 404);
      }
      if (request.status !== 'PENDING') {
        throw new AppError(`Cannot approve request that is in status '${request.status.toLowerCase()}'.`, 400);
      }

      // CENTRAL: transition status to UNDER_MAINTENANCE
      await transitionAssetStatus(request.assetId, 'UNDER_MAINTENANCE', 'Maintenance approved', tx);

      // Save previous asset status on the request record and update status
      const updated = await tx.maintenanceRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedById,
          previousAssetStatus: request.asset.status
        },
        include: {
          asset: { select: { id: true, assetTag: true, name: true, isBookable: true } },
          raisedBy: { select: { id: true, name: true } }
        }
      });

      return updated;
    }).then((updated) => {
      eventBus.emit('entity.action', {
        type: 'maintenance.approved',
        entityType: 'maintenance',
        entityId: updated.id,
        relatedAssetId: updated.assetId,
        data: {
          assetTag: updated.asset.assetTag,
          approvedById,
          isBookable: updated.asset.isBookable
        },
        timestamp: new Date().toISOString()
      });

      return updated;
    });
  }

  /**
   * 3A.3: Reject maintenance request.
   * No asset status change.
   */
  async rejectRequest(id, approvedById) {
    const request = await prisma.maintenanceRequest.findUnique({
      where: { id }
    });

    if (!request) {
      throw new AppError('Maintenance request not found.', 404);
    }
    if (request.status !== 'PENDING') {
      throw new AppError(`Cannot reject request in status '${request.status.toLowerCase()}'.`, 400);
    }

    const updated = await prisma.maintenanceRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approvedById
      },
      include: {
        asset: { select: { id: true, assetTag: true, name: true } }
      }
    });

    eventBus.emit('entity.action', {
      type: 'maintenance.rejected',
      entityType: 'maintenance',
      entityId: updated.id,
      relatedAssetId: updated.assetId,
      data: {
        assetTag: updated.asset.assetTag,
        approvedById
      },
      timestamp: new Date().toISOString()
    });

    return updated;
  }

  /**
   * 3A.4: Assign technician to maintenance request.
   */
  async assignTechnician(id, technicianId) {
    const [request, technician] = await Promise.all([
      prisma.maintenanceRequest.findUnique({ where: { id } }),
      prisma.employee.findUnique({ where: { id: technicianId } })
    ]);

    if (!request) {
      throw new AppError('Maintenance request not found.', 404);
    }
    if (!technician || technician.status !== 'ACTIVE') {
      throw new AppError('Technician not found or is inactive.', 404);
    }
    if (request.status !== 'APPROVED') {
      throw new AppError('Can only assign technicians to approved maintenance requests.', 400);
    }

    const updated = await prisma.maintenanceRequest.update({
      where: { id },
      data: {
        status: 'TECHNICIAN_ASSIGNED',
        technicianId
      },
      include: {
        asset: { select: { id: true, assetTag: true } },
        technician: { select: { id: true, name: true } }
      }
    });

    eventBus.emit('entity.action', {
      type: 'maintenance.assigned',
      entityType: 'maintenance',
      entityId: updated.id,
      relatedAssetId: updated.assetId,
      data: {
        assetTag: updated.asset.assetTag,
        technicianName: updated.technician.name
      },
      timestamp: new Date().toISOString()
    });

    return updated;
  }

  /**
   * Start progress on maintenance request (technician starts work)
   */
  async startProgress(id) {
    const request = await prisma.maintenanceRequest.findUnique({ where: { id } });

    if (!request) {
      throw new AppError('Maintenance request not found.', 404);
    }
    if (request.status !== 'TECHNICIAN_ASSIGNED') {
      throw new AppError('Technician must be assigned before starting work.', 400);
    }

    const updated = await prisma.maintenanceRequest.update({
      where: { id },
      data: { status: 'IN_PROGRESS' },
      include: { asset: { select: { id: true, assetTag: true } } }
    });

    eventBus.emit('entity.action', {
      type: 'maintenance.in_progress',
      entityType: 'maintenance',
      entityId: updated.id,
      relatedAssetId: updated.assetId,
      data: { assetTag: updated.asset.assetTag },
      timestamp: new Date().toISOString()
    });

    return updated;
  }

  /**
   * 3A.5: Resolve maintenance request.
   * Flips asset back to previous_asset_status (or AVAILABLE if null).
   */
  async resolveRequest(id) {
    return prisma.$transaction(async (tx) => {
      const request = await tx.maintenanceRequest.findUnique({
        where: { id },
        include: { asset: { select: { id: true, assetTag: true } } }
      });

      if (!request) {
        throw new AppError('Maintenance request not found.', 404);
      }
      if (!['TECHNICIAN_ASSIGNED', 'IN_PROGRESS'].includes(request.status)) {
        throw new AppError('Can only resolve requests that are assigned or in progress.', 400);
      }

      const restoreStatus = request.previousAssetStatus || 'AVAILABLE';

      // CENTRAL: transition status back to previous status
      await transitionAssetStatus(request.assetId, restoreStatus, 'Maintenance resolved', tx);

      const updated = await tx.maintenanceRequest.update({
        where: { id },
        data: {
          status: 'RESOLVED',
          resolvedAt: new Date()
        },
        include: {
          asset: { select: { id: true, assetTag: true, name: true } },
          raisedBy: { select: { id: true, name: true } }
        }
      });

      return updated;
    }).then((updated) => {
      eventBus.emit('entity.action', {
        type: 'maintenance.resolved',
        entityType: 'maintenance',
        entityId: updated.id,
        relatedAssetId: updated.assetId,
        data: {
          assetTag: updated.asset.assetTag,
          resolvedAt: updated.resolvedAt
        },
        timestamp: new Date().toISOString()
      });

      return updated;
    });
  }

  /**
   * Get list of requests with pagination/filters
   */
  async getAll(filters = {}, pagination = { page: 1, limit: 20 }) {
    const { assetId, status, priority, raisedById } = filters;
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const where = {};
    if (assetId) where.assetId = assetId;
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (raisedById) where.raisedById = raisedById;

    const [requests, total] = await Promise.all([
      prisma.maintenanceRequest.findMany({
        where,
        include: {
          asset: { select: { id: true, assetTag: true, name: true, status: true } },
          raisedBy: { select: { id: true, name: true } },
          approvedBy: { select: { id: true, name: true } },
          technician: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.maintenanceRequest.count({ where })
    ]);

    return {
      data: requests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
}

module.exports = new MaintenanceService();
