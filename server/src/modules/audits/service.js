/**
 * Audits Module — Service Layer.
 * Audit cycles: create → assign auditors → mark items → close (with cascade).
 * Close is atomic: locks cycle, cascades Missing → Lost, generates discrepancy report.
 */

const { prisma } = require('../../config/postgres');
const { transitionAssetStatus } = require('../assets/stateMachine');
const { sendNotification, sendBulkNotifications } = require('../notifications/notificationService');
const AppError = require('../../utils/AppError');

/**
 * Create an audit cycle.
 */
async function createAuditCycle({ scopeType, scopeValue, dateStart, dateEnd }) {
  return prisma.auditCycle.create({
    data: {
      scopeType,
      scopeValue,
      dateStart: new Date(dateStart),
      dateEnd: new Date(dateEnd),
      status: 'OPEN',
    },
  });
}

/**
 * Assign auditors to a cycle.
 */
async function assignAuditors(cycleId, auditorIds) {
  const cycle = await prisma.auditCycle.findUnique({ where: { id: cycleId } });
  if (!cycle) throw new AppError('Audit cycle not found.', 404);
  if (cycle.status === 'CLOSED') throw new AppError('Cannot modify a closed audit cycle.', 400);

  // Validate all auditor IDs
  const auditors = await prisma.employee.findMany({
    where: { id: { in: auditorIds } },
    select: { id: true, name: true },
  });

  if (auditors.length !== auditorIds.length) {
    throw new AppError('One or more auditor IDs are invalid.', 400);
  }

  // Upsert assignments (skip duplicates)
  const assignments = await Promise.all(
    auditorIds.map((auditorId) =>
      prisma.auditAssignment.upsert({
        where: {
          auditCycleId_auditorId: { auditCycleId: cycleId, auditorId },
        },
        create: { auditCycleId: cycleId, auditorId },
        update: {},
      })
    )
  );

  // Notify auditors
  setImmediate(() => {
    sendBulkNotifications(
      auditorIds.map((auditorId) => ({
        userId: auditorId,
        type: 'AUDIT_ASSIGNED',
        message: `You have been assigned as an auditor for audit cycle (${cycle.scopeType}: ${cycle.scopeValue}).`,
        relatedEntityId: cycleId,
        relatedEntityType: 'audit',
      }))
    );
  });

  return assignments;
}

/**
 * Get assets in scope for the audit cycle (for auditors to mark).
 */
async function getAuditAssets(cycleId) {
  const cycle = await prisma.auditCycle.findUnique({ where: { id: cycleId } });
  if (!cycle) throw new AppError('Audit cycle not found.', 404);

  let assetWhere = {};

  if (cycle.scopeType === 'DEPARTMENT') {
    // Assets allocated to this department
    assetWhere = {
      allocations: {
        some: {
          status: 'ACTIVE',
          departmentHolder: { name: { equals: cycle.scopeValue, mode: 'insensitive' } },
        },
      },
    };
  } else if (cycle.scopeType === 'LOCATION') {
    assetWhere = {
      location: { equals: cycle.scopeValue, mode: 'insensitive' },
    };
  }

  const assets = await prisma.asset.findMany({
    where: {
      ...assetWhere,
      status: { notIn: ['DISPOSED'] }, // Don't audit disposed assets
    },
    include: {
      category: { select: { id: true, name: true } },
      auditItems: {
        where: { auditCycleId: cycleId },
        select: { id: true, result: true, notes: true, auditor: { select: { id: true, name: true } } },
      },
    },
    orderBy: { assetTag: 'asc' },
  });

  return assets;
}

/**
 * Mark an audit item (Verified / Missing / Damaged).
 */
async function markAuditItem(itemId, { result, notes }) {
  const item = await prisma.auditItem.findUnique({
    where: { id: itemId },
    include: { auditCycle: true },
  });

  if (!item) throw new AppError('Audit item not found.', 404);
  if (item.auditCycle.status === 'CLOSED') {
    throw new AppError('Cannot modify items in a closed audit cycle.', 400);
  }

  return prisma.auditItem.update({
    where: { id: itemId },
    data: { result, notes: notes || null },
    include: {
      asset: { select: { id: true, assetTag: true, name: true } },
      auditor: { select: { id: true, name: true } },
    },
  });
}

/**
 * Create audit items for all assets in scope (batch).
 */
async function createAuditItems(cycleId, auditorId, assetIds) {
  const cycle = await prisma.auditCycle.findUnique({ where: { id: cycleId } });
  if (!cycle) throw new AppError('Audit cycle not found.', 404);
  if (cycle.status === 'CLOSED') throw new AppError('Cannot modify a closed audit cycle.', 400);

  const items = await Promise.all(
    assetIds.map((assetId) =>
      prisma.auditItem.upsert({
        where: {
          auditCycleId_assetId: { auditCycleId: cycleId, assetId },
        },
        create: {
          auditCycleId: cycleId,
          assetId,
          auditorId,
        },
        update: {},
        include: {
          asset: { select: { id: true, assetTag: true, name: true } },
        },
      })
    )
  );

  return items;
}

/**
 * Close an audit cycle — ATOMIC.
 * 1. Lock cycle
 * 2. For every item with result = MISSING → asset.status = LOST
 * 3. Generate discrepancy report
 * 4. Set cycle status = CLOSED
 */
async function closeAuditCycle(cycleId) {
  return prisma.$transaction(async (tx) => {
    const cycle = await tx.auditCycle.findUnique({
      where: { id: cycleId },
      include: {
        items: {
          include: {
            asset: { select: { id: true, assetTag: true, name: true, status: true } },
            auditor: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!cycle) throw new AppError('Audit cycle not found.', 404);
    if (cycle.status === 'CLOSED') throw new AppError('Audit cycle is already closed.', 400);

    // Find discrepancies
    const discrepancies = cycle.items.filter(
      (item) => item.result === 'MISSING' || item.result === 'DAMAGED'
    );

    // Cascade: Missing → Lost
    const missingItems = cycle.items.filter((item) => item.result === 'MISSING');
    for (const item of missingItems) {
      try {
        await transitionAssetStatus(
          item.assetId,
          'LOST',
          `Confirmed missing in audit cycle ${cycleId}`,
          tx
        );
      } catch (err) {
        // Log but don't break the transaction — some assets might already be LOST
        console.warn(`⚠️  Could not transition asset ${item.asset.assetTag} to LOST: ${err.message}`);
      }
    }

    // Close the cycle
    await tx.auditCycle.update({
      where: { id: cycleId },
      data: { status: 'CLOSED' },
    });

    // Generate discrepancy report
    const report = {
      cycleId,
      scopeType: cycle.scopeType,
      scopeValue: cycle.scopeValue,
      dateStart: cycle.dateStart,
      dateEnd: cycle.dateEnd,
      closedAt: new Date(),
      totalAssetsAudited: cycle.items.length,
      verified: cycle.items.filter((i) => i.result === 'VERIFIED').length,
      missing: missingItems.length,
      damaged: discrepancies.filter((i) => i.result === 'DAMAGED').length,
      unmarked: cycle.items.filter((i) => !i.result).length,
      discrepancies: discrepancies.map((d) => ({
        assetId: d.assetId,
        assetTag: d.asset.assetTag,
        assetName: d.asset.name,
        previousStatus: d.asset.status,
        result: d.result,
        notes: d.notes,
        auditor: d.auditor,
      })),
    };

    // Notify about discrepancies
    if (discrepancies.length > 0) {
      setImmediate(() => {
        // Notify all assigned auditors
        const auditorIds = [...new Set(cycle.items.map((i) => i.auditorId))];
        sendBulkNotifications(
          auditorIds.map((auditorId) => ({
            userId: auditorId,
            type: 'AUDIT_DISCREPANCY',
            message: `Audit cycle closed: ${discrepancies.length} discrepancies found (${missingItems.length} missing, ${discrepancies.length - missingItems.length} damaged).`,
            relatedEntityId: cycleId,
            relatedEntityType: 'audit',
            metadata: { discrepancyCount: discrepancies.length },
          }))
        );
      });
    }

    return report;
  });
}

/**
 * Get all audit cycles.
 */
async function getAuditCycles({ status, page = 1, limit = 20 } = {}) {
  const where = {};
  if (status) where.status = status;

  const skip = (page - 1) * limit;

  const [cycles, total] = await Promise.all([
    prisma.auditCycle.findMany({
      where,
      include: {
        _count: { select: { items: true, assignments: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.auditCycle.count({ where }),
  ]);

  return { cycles, total, page, limit, totalPages: Math.ceil(total / limit) };
}

module.exports = {
  createAuditCycle,
  assignAuditors,
  getAuditAssets,
  markAuditItem,
  createAuditItems,
  closeAuditCycle,
  getAuditCycles,
};
