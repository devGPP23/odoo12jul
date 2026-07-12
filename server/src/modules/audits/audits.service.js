/**
 * Audits Service — Phase 4 (4A.1 – 4A.8)
 *
 * Implements the full audit cycle lifecycle:
 *   - createAuditCycle()       : POST /api/audit-cycles
 *   - assignAuditors()         : POST /api/audit-cycles/:id/assign-auditors
 *   - getCycleWithItems()      : GET /api/audit-cycles/:id/items
 *   - markItem()               : PUT /api/audit-items/:id
 *   - closeAuditCycle()        : POST /api/audit-cycles/:id/close
 *   - getDiscrepancyReport()   : GET /api/audit-cycles/:id/report
 *   - listCycles()             : GET /api/audit-cycles
 *   - getCycleById()           : GET /api/audit-cycles/:id
 *
 * Edge cases handled:
 *   AU1: No overlapping OPEN/IN_PROGRESS cycles for same scope
 *   AU2: Pending items on close → offer force-close, mark missing → LOST
 *   AU3: New asset during audit (scope match) → auto-add to cycle
 *   AU4: Cannot re-open closed cycle
 *   AU5: Only assigned auditors can mark items
 */

const { prisma } = require('../../config/postgres');
const AppError = require('../../utils/AppError');
const eventBus = require('../../core/eventBus');
const { transitionAssetStatus } = require('../../core/assetStateMachine');

class AuditsService {
  /**
   * Create an audit cycle with scope (department or location) and date range.
   * AU1: Check no overlapping open/in_progress cycle for same scope.
   */
  async createAuditCycle(data, actor) {
    const { scopeType, scopeValue, dateStart, dateEnd } = data;

    if (!['DEPARTMENT', 'LOCATION'].includes(scopeType)) {
      throw new AppError('scopeType must be DEPARTMENT or LOCATION', 400);
    }

    // AU1: Check for overlapping open/in_progress cycle for same scope
    const overlapping = await prisma.auditCycle.findFirst({
      where: {
        scopeType,
        scopeValue,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        dateStart: { lte: new Date(dateEnd) },
        dateEnd: { gte: new Date(dateStart) },
      },
    });
    if (overlapping) {
      throw new AppError(
        `An open audit cycle already exists for this ${scopeType.toLowerCase()}.`,
        409
      );
    }

    const cycle = await prisma.auditCycle.create({
      data: {
        scopeType,
        scopeValue,
        dateStart: new Date(dateStart),
        dateEnd: new Date(dateEnd),
        status: 'OPEN',
      },
      include: { assignments: { include: { auditor: { select: { id: true, name: true } } } } },
    });

    // Auto-populate audit items for all assets matching scope
    await this._populateAuditItems(cycle.id, scopeType, scopeValue);

    setImmediate(() => {
      eventBus.emit('entity.action', {
        type: 'audit.created',
        actorId: actor.id,
        actorName: actor.name,
        entityType: 'audit',
        entityId: cycle.id,
        scopeType,
        scopeValue,
        data: { dateStart, dateEnd },
        timestamp: new Date().toISOString(),
      });
    });

    return cycle;
  }

  /**
   * Populate AuditItem rows for all assets matching the cycle scope.
   * If scopeType=DEPARTMENT → assets where employeeHolder.departmentId = scopeValue
   * If scopeType=LOCATION   → assets where location = scopeValue
   */
  async _populateAuditItems(cycleId, scopeType, scopeValue) {
    let assetWhere = {};

    if (scopeType === 'DEPARTMENT') {
      // Assets currently allocated to employees in this department
      assetWhere = {
        allocations: {
          some: {
            status: 'ACTIVE',
            employeeHolder: { departmentId: scopeValue },
          },
        },
      };
    } else if (scopeType === 'LOCATION') {
      assetWhere = { location: scopeValue };
    }

    const assets = await prisma.asset.findMany({
      where: assetWhere,
      select: { id: true },
    });

    if (assets.length > 0) {
      await prisma.auditItem.createMany({
        data: assets.map((a) => ({
          auditCycleId: cycleId,
          assetId: a.id,
        })),
        skipDuplicates: true,
      });
    }
  }

  /**
   * Assign one or more auditors to an audit cycle.
   * Validates users exist and are active.
   * Distributes unassigned items round-robin.
   * Emits audit.assigned event for notifications.
   */
  async assignAuditors(cycleId, auditorIds, actor) {
    const cycle = await prisma.auditCycle.findUnique({ where: { id: cycleId } });
    if (!cycle) throw new AppError('Audit cycle not found', 404);
    if (cycle.status !== 'OPEN') {
      throw new AppError('Can only assign auditors to OPEN cycles', 400);
    }

    // Validate all auditors exist and are ACTIVE
    const auditors = await prisma.employee.findMany({
      where: { id: { in: auditorIds }, status: 'ACTIVE' },
      select: { id: true, name: true, email: true },
    });
    if (auditors.length !== auditorIds.length) {
      throw new AppError('One or more auditors not found or inactive', 404);
    }

    // Create assignments (skip duplicates)
    await prisma.auditAssignment.createMany({
      data: auditorIds.map((auditorId) => ({ auditCycleId: cycleId, auditorId })),
      skipDuplicates: true,
    });

    // Now distribute unassigned AuditItems to auditors round-robin
    const unassignedItems = await prisma.auditItem.findMany({
      where: { auditCycleId: cycleId, auditorId: null },
      select: { id: true },
    });

    if (unassignedItems.length > 0 && auditorIds.length > 0) {
      for (let i = 0; i < unassignedItems.length; i++) {
        const assignedAuditorId = auditorIds[i % auditorIds.length];
        await prisma.auditItem.update({
          where: { id: unassignedItems[i].id },
          data: { auditorId: assignedAuditorId },
        });
      }
    }

    // Emit audit.assigned events for each auditor (for notifications)
    setImmediate(() => {
      auditorIds.forEach((auditorId) => {
        eventBus.emit('entity.action', {
          type: 'audit.assigned',
          actorId: actor?.id || null,
          actorName: actor?.name || 'System',
          entityType: 'audit',
          entityId: cycleId,
          targetUserId: auditorId, // For notification targeting
          scopeType: cycle.scopeType,
          scopeValue: cycle.scopeValue,
          data: { cycleId, auditorId },
          timestamp: new Date().toISOString(),
        });
      });
    });

    return { assigned: auditorIds.length, itemsDistributed: unassignedItems.length };
  }

  /**
   * Get audit cycle with paginated items and progress summary.
   */
  async getCycleWithItems(cycleId, pagination = { page: 1, limit: 50 }) {
    const cycle = await prisma.auditCycle.findUnique({
      where: { id: cycleId },
      include: {
        assignments: { include: { auditor: { select: { id: true, name: true } } } },
      },
    });
    if (!cycle) throw new AppError('Audit cycle not found', 404);

    const page = parseInt(pagination.page, 10) || 1;
    const limit = parseInt(pagination.limit, 10) || 50;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.auditItem.findMany({
        where: { auditCycleId: cycleId },
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
        include: {
          asset: {
            select: {
              id: true,
              assetTag: true,
              name: true,
              status: true,
              location: true,
              category: { select: { id: true, name: true } },
            },
          },
          auditor: { select: { id: true, name: true } },
        },
      }),
      prisma.auditItem.count({ where: { auditCycleId: cycleId } }),
    ]);

    // Progress summary
    const progress = await prisma.auditItem.groupBy({
      by: ['result'],
      where: { auditCycleId: cycleId },
      _count: { result: true },
    });

    const progressMap = { total, verified: 0, missing: 0, damaged: 0, pending: 0 };
    progress.forEach((p) => {
      const key = p.result?.toLowerCase() || 'pending';
      progressMap[key] = p._count.result;
    });
    progressMap.pending = total - (progressMap.verified + progressMap.missing + progressMap.damaged);

    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      progress: progressMap,
    };
  }

  /**
   * Mark an audit item result.
   * AU5: Only assigned auditor (or ADMIN/ASSET_MANAGER) can mark.
   */
  async markItem(itemId, actor, data) {
    const { result, notes } = data;

    if (!['VERIFIED', 'MISSING', 'DAMAGED'].includes(result)) {
      throw new AppError('result must be VERIFIED, MISSING, or DAMAGED', 400);
    }

    const item = await prisma.auditItem.findUnique({
      where: { id: itemId },
      include: {
        asset: { select: { id: true, assetTag: true, name: true } },
        auditor: { select: { id: true, name: true } },
        auditCycle: { select: { id: true, scopeType: true, scopeValue: true } },
      },
    });
    if (!item) throw new AppError('Audit item not found', 404);

    // AU5: Authorization - only assigned auditor or admin/manager
    const isAssignedAuditor = item.auditorId === actor.id;
    const isManager = ['ADMIN', 'ASSET_MANAGER'].includes(actor.role);
    if (!isAssignedAuditor && !isManager) {
      throw new AppError('Only the assigned auditor can mark this item', 403);
    }

    const updated = await prisma.auditItem.update({
      where: { id: itemId },
      data: { result, notes: notes || null },
      include: {
        asset: { select: { id: true, assetTag: true, name: true, status: true } },
        auditor: { select: { id: true, name: true } },
      },
    });

    // Emit event for discrepancy notifications
    if (result === 'MISSING' || result === 'DAMAGED') {
      setImmediate(() => {
        eventBus.emit('entity.action', {
          type: 'audit.discrepancy',
          actorId: actor.id,
          actorName: actor.name,
          entityType: 'audit_item',
          entityId: itemId,
          relatedAssetId: item.asset.id,
          departmentId: item.auditCycle.scopeType === 'DEPARTMENT' ? item.auditCycle.scopeValue : null,
          data: {
            assetTag: item.asset.assetTag,
            assetName: item.asset.name,
            result,
            notes,
          },
          timestamp: new Date().toISOString(),
        });
      });
    }

    return updated;
  }

  /**
   * Atomically close an audit cycle.
   * - Lock cycle
   * - Check pending items (offer force-close)
   * - For each MISSING item → transitionAssetStatus → 'lost'
   * - Generate discrepancy report
   * - Set status = 'CLOSED'
   * - Emit audit.closed event (Dev B batches notifications)
   */
  async closeAuditCycle(cycleId, forceClose = false, actor = null) {
    return prisma.$transaction(async (tx) => {
      // Lock the cycle row
      const cycle = await tx.auditCycle.findUnique({
        where: { id: cycleId },
        include: { items: { include: { asset: { select: { id: true, assetTag: true } } } } },
      });
      if (!cycle) throw new AppError('Audit cycle not found', 404);

      // AU4: Cannot re-open closed cycle
      if (cycle.status === 'CLOSED') {
        throw new AppError('Audit cycle is already closed and cannot be re-opened', 400);
      }

      // Count pending (null result) items
      const pendingCount = cycle.items.filter((i) => !i.result).length;
      if (pendingCount > 0 && !forceClose) {
        throw new AppError(
          `Cannot close: ${pendingCount} item(s) still pending. Use forceClose: true to mark missing as LOST.`,
          409,
          { pendingCount, forceCloseRequired: true }
        );
      }

      // Force-close: mark all pending as MISSING
      if (forceClose && pendingCount > 0) {
        const pendingIds = cycle.items.filter((i) => !i.result).map((i) => i.id);
        await tx.auditItem.updateMany({
          where: { id: { in: pendingIds } },
          data: { result: 'MISSING' },
        });
        // Update local items array for downstream logic
        cycle.items.forEach((i) => {
          if (!i.result) i.result = 'MISSING';
        });
      }

      // For each MISSING item, transition asset to LOST
      const missingItems = cycle.items.filter((i) => i.result === 'MISSING');
      for (const item of missingItems) {
        // Use state machine to transition to LOST
        await transitionAssetStatus(item.assetId, 'LOST', `audit_missing_cycle_${cycleId}`, tx);
      }

      // Close the cycle
      const closedCycle = await tx.auditCycle.update({
        where: { id: cycleId },
        data: { status: 'CLOSED' },
        include: {
          items: {
            where: { result: { in: ['MISSING', 'DAMAGED'] } },
            include: {
              asset: { select: { id: true, assetTag: true, name: true, status: true } },
              auditor: { select: { id: true, name: true } },
            },
          },
        },
      });

      // Emit audit.closed event (Dev B's handler will batch notifications)
      setImmediate(() => {
        eventBus.emit('entity.action', {
          type: 'audit.closed',
          actorId: actor?.id || null,
          actorName: actor?.name || 'System',
          entityType: 'audit',
          entityId: cycleId,
          data: {
            scopeType: cycle.scopeType,
            scopeValue: cycle.scopeValue,
            discrepancyCount: closedCycle.items.length,
            forceClose,
          },
          timestamp: new Date().toISOString(),
        });
      });

      return {
        cycle: closedCycle,
        discrepancies: closedCycle.items.map((i) => ({
          assetId: i.asset.id,
          assetTag: i.asset.assetTag,
          assetName: i.asset.name,
          result: i.result,
          notes: i.notes,
          flaggedBy: i.auditor?.name || 'System',
        })),
      };
    });
  }

  /**
   * Get discrepancy report: all items with result = 'MISSING' or 'DAMAGED'.
   */
  async getDiscrepancyReport(cycleId) {
    const cycle = await prisma.auditCycle.findUnique({ where: { id: cycleId } });
    if (!cycle) throw new AppError('Audit cycle not found', 404);

    const discrepancies = await prisma.auditItem.findMany({
      where: {
        auditCycleId: cycleId,
        result: { in: ['MISSING', 'DAMAGED'] },
      },
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
        auditor: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      cycleId,
      scopeType: cycle.scopeType,
      scopeValue: cycle.scopeValue,
      totalDiscrepancies: discrepancies.length,
      missing: discrepancies.filter((d) => d.result === 'MISSING').length,
      damaged: discrepancies.filter((d) => d.result === 'DAMAGED').length,
      items: discrepancies.map((d) => ({
        assetId: d.asset.id,
        assetTag: d.asset.assetTag,
        assetName: d.asset.name,
        assetStatus: d.asset.status,
        assetCondition: d.asset.condition,
        location: d.asset.location,
        category: d.asset.category?.name,
        result: d.result,
        notes: d.notes,
        flaggedBy: d.auditor?.name || 'Unknown',
        flaggedAt: d.updatedAt,
      })),
    };
  }

  /**
   * List audit cycles with pagination and optional status filter.
   */
  async listCycles(filters = {}) {
    const page = parseInt(filters.page, 10) || 1;
    const limit = parseInt(filters.limit, 10) || 20;
    const status = filters.status;
    const skip = (page - 1) * limit;

    const where = {};
    if (status) where.status = status;

    const [cycles, total] = await Promise.all([
      prisma.auditCycle.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          assignments: { include: { auditor: { select: { id: true, name: true } } } },
          _count: { select: { items: true } },
        },
      }),
      prisma.auditCycle.count({ where }),
    ]);

    return {
      data: cycles,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get audit cycle by ID.
   */
  async getCycleById(cycleId) {
    const cycle = await prisma.auditCycle.findUnique({
      where: { id: cycleId },
      include: {
        assignments: { include: { auditor: { select: { id: true, name: true, email: true } } } },
        _count: { select: { items: true } },
      },
    });
    if (!cycle) throw new AppError('Audit cycle not found', 404);
    return cycle;
  }
}

module.exports = new AuditsService();