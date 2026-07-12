const { prisma } = require('../../config/postgres');
const AppError = require('../../utils/AppError');
const eventBus = require('../../core/eventBus');

class AuditsService {
  /**
   * 4A.1: Create audit cycle.
   * Edge case AU1: check no overlapping open/in_progress cycle for same scope.
   */
  async createCycle(data) {
    const { scopeType, scopeValue, dateStart, dateEnd } = data;

    // Validate dates
    const start = new Date(dateStart);
    const end = new Date(dateEnd);
    if (end <= start) {
      throw new AppError('dateEnd must be after dateStart.', 400);
    }

    // AU1: Check no overlapping OPEN or IN_PROGRESS cycle for the same scope
    const overlapping = await prisma.auditCycle.findFirst({
      where: {
        scopeType,
        scopeValue,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        // Date ranges overlap if: existing.start < new.end AND existing.end > new.start
        dateStart: { lt: end },
        dateEnd: { gt: start }
      }
    });

    if (overlapping) {
      throw new AppError(
        `An overlapping ${overlapping.status.toLowerCase()} audit cycle already exists for this scope (${scopeType}:${scopeValue}) from ${overlapping.dateStart.toISOString().split('T')[0]} to ${overlapping.dateEnd.toISOString().split('T')[0]}.`,
        409
      );
    }

    // Validate scope value exists
    if (scopeType === 'DEPARTMENT') {
      const dept = await prisma.department.findFirst({
        where: { name: { equals: scopeValue, mode: 'insensitive' } }
      });
      if (!dept) {
        throw new AppError(`Department '${scopeValue}' not found.`, 404);
      }
    }

    const cycle = await prisma.auditCycle.create({
      data: {
        scopeType,
        scopeValue,
        dateStart: start,
        dateEnd: end,
        status: 'OPEN'
      }
    });

    eventBus.emit('entity.action', {
      type: 'audit.cycle_created',
      entityType: 'audit_cycle',
      entityId: cycle.id,
      data: { scopeType, scopeValue, dateStart: start, dateEnd: end },
      timestamp: new Date().toISOString()
    });

    return cycle;
  }

  /**
   * 4A.2: Assign auditors to a cycle.
   * Validate users exist and are active. Assign one or more.
   */
  async assignAuditors(cycleId, auditorIds) {
    const cycle = await prisma.auditCycle.findUnique({ where: { id: cycleId } });
    if (!cycle) {
      throw new AppError('Audit cycle not found.', 404);
    }
    if (cycle.status === 'CLOSED') {
      throw new AppError('Cannot assign auditors to a closed cycle.', 400);
    }

    if (!auditorIds || auditorIds.length === 0) {
      throw new AppError('At least one auditorId must be provided.', 400);
    }

    // Validate all auditors exist and are active
    const employees = await prisma.employee.findMany({
      where: { id: { in: auditorIds } }
    });

    if (employees.length !== auditorIds.length) {
      const foundIds = employees.map(e => e.id);
      const missing = auditorIds.filter(id => !foundIds.includes(id));
      throw new AppError(`Employees not found: ${missing.join(', ')}`, 404);
    }

    const inactive = employees.filter(e => e.status !== 'ACTIVE');
    if (inactive.length > 0) {
      throw new AppError(
        `Employees not active: ${inactive.map(e => e.name).join(', ')}`,
        400
      );
    }

    // Create assignments (skip duplicates using skipDuplicates)
    const assignments = await prisma.auditAssignment.createMany({
      data: auditorIds.map(auditorId => ({
        auditCycleId: cycleId,
        auditorId
      })),
      skipDuplicates: true
    });

    // Fetch all current assignments for the response
    const allAssignments = await prisma.auditAssignment.findMany({
      where: { auditCycleId: cycleId },
      include: {
        auditor: { select: { id: true, name: true, email: true, role: true } }
      }
    });

    eventBus.emit('entity.action', {
      type: 'audit.auditors_assigned',
      entityType: 'audit_cycle',
      entityId: cycleId,
      data: { auditorIds, newlyAssigned: assignments.count },
      timestamp: new Date().toISOString()
    });

    return {
      cycleId,
      totalAssigned: allAssignments.length,
      newlyAssigned: assignments.count,
      auditors: allAssignments.map(a => a.auditor)
    };
  }

  /**
   * 4A.3: Auto-populate audit items.
   * Query all assets matching scope → create AuditItem rows.
   * DEPARTMENT → all assets whose active allocation holder belongs to that department.
   * LOCATION  → all assets at that location.
   */
  async populateItems(cycleId) {
    const cycle = await prisma.auditCycle.findUnique({
      where: { id: cycleId },
      include: { assignments: true }
    });

    if (!cycle) {
      throw new AppError('Audit cycle not found.', 404);
    }
    if (cycle.status === 'CLOSED') {
      throw new AppError('Cannot populate items for a closed cycle.', 400);
    }
    if (cycle.assignments.length === 0) {
      throw new AppError('Assign at least one auditor before populating items.', 400);
    }

    let assets = [];

    if (cycle.scopeType === 'DEPARTMENT') {
      // Find department by name (case-insensitive)
      const dept = await prisma.department.findFirst({
        where: { name: { equals: cycle.scopeValue, mode: 'insensitive' } }
      });

      if (!dept) {
        throw new AppError(`Department '${cycle.scopeValue}' not found.`, 404);
      }

      // Find all assets currently allocated to employees in this department
      // OR assets allocated to the department itself
      const allocations = await prisma.allocation.findMany({
        where: {
          status: 'ACTIVE',
          OR: [
            { employeeHolder: { departmentId: dept.id } },
            { departmentHolderId: dept.id }
          ]
        },
        select: { assetId: true }
      });

      const assetIds = [...new Set(allocations.map(a => a.assetId))];

      if (assetIds.length > 0) {
        assets = await prisma.asset.findMany({
          where: { id: { in: assetIds } },
          select: { id: true }
        });
      }
    } else if (cycle.scopeType === 'LOCATION') {
      // All assets at that location
      assets = await prisma.asset.findMany({
        where: {
          location: { equals: cycle.scopeValue, mode: 'insensitive' }
        },
        select: { id: true }
      });
    }

    if (assets.length === 0) {
      return { cycleId, itemsCreated: 0, message: 'No assets found matching the scope.' };
    }

    // Round-robin assignment of auditors across assets
    const auditorIds = cycle.assignments.map(a => a.auditorId);

    const itemsData = assets.map((asset, index) => ({
      auditCycleId: cycleId,
      assetId: asset.id,
      auditorId: auditorIds[index % auditorIds.length]
    }));

    // Use createMany with skipDuplicates (unique constraint: auditCycleId + assetId)
    const result = await prisma.auditItem.createMany({
      data: itemsData,
      skipDuplicates: true
    });

    // Transition cycle to IN_PROGRESS
    if (cycle.status === 'OPEN') {
      await prisma.auditCycle.update({
        where: { id: cycleId },
        data: { status: 'IN_PROGRESS' }
      });
    }

    eventBus.emit('entity.action', {
      type: 'audit.items_populated',
      entityType: 'audit_cycle',
      entityId: cycleId,
      data: { totalAssets: assets.length, itemsCreated: result.count },
      timestamp: new Date().toISOString()
    });

    return {
      cycleId,
      itemsCreated: result.count,
      totalAssetsInScope: assets.length
    };
  }

  /**
   * 4A.4: Get audit items for a cycle — paginated (50/page) with progress.
   * Response: { items: [...], progress: { total, verified, missing, damaged, pending } }
   */
  async getCycleItems(cycleId, { page = 1, limit = 50 } = {}) {
    const cycle = await prisma.auditCycle.findUnique({ where: { id: cycleId } });
    if (!cycle) {
      throw new AppError('Audit cycle not found.', 404);
    }

    const skip = (page - 1) * limit;

    const [items, totalItems] = await Promise.all([
      prisma.auditItem.findMany({
        where: { auditCycleId: cycleId },
        include: {
          asset: {
            select: {
              id: true, assetTag: true, name: true,
              status: true, condition: true, location: true
            }
          },
          auditor: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.auditItem.count({ where: { auditCycleId: cycleId } })
    ]);

    // Calculate progress counters
    const allItems = await prisma.auditItem.groupBy({
      by: ['result'],
      where: { auditCycleId: cycleId },
      _count: { id: true }
    });

    const progress = {
      total: totalItems,
      verified: 0,
      missing: 0,
      damaged: 0,
      pending: 0
    };

    allItems.forEach(group => {
      if (group.result === 'VERIFIED') progress.verified = group._count.id;
      else if (group.result === 'MISSING') progress.missing = group._count.id;
      else if (group.result === 'DAMAGED') progress.damaged = group._count.id;
      else if (group.result === null) progress.pending = group._count.id;
    });

    return {
      items,
      progress,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalItems,
        totalPages: Math.ceil(totalItems / limit)
      }
    };
  }

  /**
   * Get all audit cycles with pagination/filters.
   */
  async getAllCycles({ status, scopeType, page = 1, limit = 20 } = {}) {
    const where = {};
    if (status) where.status = status;
    if (scopeType) where.scopeType = scopeType;

    const skip = (page - 1) * limit;

    const [cycles, total] = await Promise.all([
      prisma.auditCycle.findMany({
        where,
        include: {
          _count: { select: { assignments: true, items: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.auditCycle.count({ where })
    ]);

    return {
      data: cycles,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
}

module.exports = new AuditsService();
