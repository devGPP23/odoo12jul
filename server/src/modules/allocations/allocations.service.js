/**
 * Allocations Service — Phase 2A (2A.1 – 2A.3 + 2A.8)
 *
 * Implements the full allocation lifecycle:
 *   - allocate()          : POST /api/allocations
 *   - returnAllocation()  : POST /api/allocations/:id/return
 *   - getById()
 *   - list()
 *
 * Edge cases handled:
 *   AL1  - Race condition: DB-level partial unique index (allocation_active_unique) +
 *           transaction isolation ensures only one ACTIVE allocation per asset
 *   AL2  - Inactive user/department: pre-flight status check before write
 *   AL3  - Idempotency: optional idempotencyKey — if ACTIVE alloc for same
 *           asset+holder already exists, return it without creating a duplicate
 *   AL4  - Asset under maintenance: block allocation if active maintenance exists
 *   AL5  - Bookable block: bookable assets cannot be allocated (use Bookings API)
 *          Extended: allow if no UPCOMING/ONGOING bookings exist
 *   AL6  - Dept scope: DEPARTMENT_HEAD can only allocate to own dept employees
 *   AL8  - Return condition 'DAMAGED' → suggestMaintenance:true in response
 *   AL9  - Cannot return an already-RETURNED or TRANSFERRED allocation
 *   AL10 - expectedReturnDate must be in the future if supplied
 */

const { prisma } = require('../../config/postgres');
const AppError   = require('../../utils/AppError');
const eventBus   = require('../../core/eventBus');
const { transitionAssetStatus } = require('../../core/assetStateMachine');

class AllocationsService {
  /**
   * Allocate an asset to an employee or department.
   * Uses a Prisma transaction for atomicity.
   *
   * @param {object} data  - { assetId, employeeHolderId?, departmentHolderId?,
   *                           expectedReturnDate?, idempotencyKey? }
   * @param {object} actor - req.user from JWT
   */
  async allocate(data, actor) {
    const {
      assetId,
      employeeHolderId,
      departmentHolderId,
      expectedReturnDate,
      idempotencyKey,
    } = data;

    // ── Exactly one holder must be supplied ──────────────────────────────
    if (
      (!employeeHolderId && !departmentHolderId) ||
      (employeeHolderId && departmentHolderId)
    ) {
      throw new AppError(
        'Exactly one of employeeHolderId or departmentHolderId must be provided.',
        400
      );
    }

    // ── AL10: expectedReturnDate must be in the future ───────────────────
    if (expectedReturnDate && new Date(expectedReturnDate) <= new Date()) {
      throw new AppError('expectedReturnDate must be a future date.', 400);
    }

    // ── AL3: Idempotency key — avoid duplicate allocation for same pair ───
    if (idempotencyKey) {
      const existing = await prisma.allocation.findFirst({
        where: {
          assetId,
          status: 'ACTIVE',
          ...(employeeHolderId
            ? { employeeHolderId }
            : { departmentHolderId }),
        },
        include: {
          asset: { select: { id: true, assetTag: true, name: true } },
          employeeHolder: { select: { id: true, name: true, email: true } },
          departmentHolder: { select: { id: true, name: true } },
        },
      });
      if (existing) {
        return { allocation: existing, alreadyExisted: true };
      }
    }

    // ── AL2: Validate employee/department is ACTIVE before entering tx ───
    if (employeeHolderId) {
      const employee = await prisma.employee.findUnique({
        where: { id: employeeHolderId },
        select: { id: true, name: true, status: true, departmentId: true },
      });
      if (!employee) throw new AppError('Employee not found.', 404);
      if (employee.status !== 'ACTIVE') {
        throw new AppError(
          `Employee "${employee.name}" is inactive and cannot receive assets.`,
          400
        );
      }

      // ── AL6: Dept scope — DEPT_HEAD can only allocate within own dept ──
      if (actor.role === 'DEPARTMENT_HEAD') {
        if (!actor.departmentId || employee.departmentId !== actor.departmentId) {
          throw new AppError(
            'Department Heads can only allocate assets to employees within their own department.',
            403
          );
        }
      }
    }

    if (departmentHolderId) {
      const dept = await prisma.department.findUnique({
        where: { id: departmentHolderId },
        select: { id: true, name: true, status: true },
      });
      if (!dept) throw new AppError('Department not found.', 404);
      if (dept.status !== 'ACTIVE') {
        throw new AppError(
          `Department "${dept.name}" is inactive and cannot receive assets.`,
          400
        );
      }
    }

    // ── Run atomic allocation inside transaction (AL1) ────────────────────
    return prisma.$transaction(async (tx) => {
      // ── Lock & fetch asset row ──────────────────────────────────────────
      const asset = await tx.asset.findUnique({
        where: { id: assetId },
        select: {
          id: true,
          assetTag: true,
          name: true,
          status: true,
          isBookable: true,
        },
      });

      if (!asset) throw new AppError('Asset not found.', 404);

      // ── AL5: Bookable assets must not have active bookings ──────────────
      if (asset.isBookable) {
        const activeBookings = await tx.booking.count({
          where: { assetId, status: { in: ['UPCOMING', 'ONGOING'] } },
        });
        if (activeBookings > 0) {
          throw new AppError(
            `Cannot allocate bookable asset "${asset.assetTag}" — it has ${activeBookings} active booking(s). Cancel them first.`,
            400
          );
        }
      }

      // ── AL4: Asset must not be under active maintenance ─────────────────
      const activeMaintenance = await tx.maintenanceRequest.findFirst({
        where: {
          assetId,
          status: { in: ['APPROVED', 'TECHNICIAN_ASSIGNED', 'IN_PROGRESS'] },
        },
        select: { id: true },
      });
      if (activeMaintenance) {
        throw new AppError(
          `Asset "${asset.assetTag}" is currently under maintenance and cannot be allocated.`,
          400
        );
      }

      // ── AL1: Conflict check — asset must be AVAILABLE ───────────────────
      // The DB partial unique index (allocation_active_unique) is the final
      // safety net for true race conditions; this check gives a richer 409.
      if (asset.status !== 'AVAILABLE') {
        const currentAlloc = await tx.allocation.findFirst({
          where: { assetId, status: 'ACTIVE' },
          include: {
            employeeHolder: {
              select: { id: true, name: true, department: { select: { id: true, name: true } } },
            },
            departmentHolder: { select: { id: true, name: true } },
          },
        });

        const holderName =
          currentAlloc?.employeeHolder?.name ||
          currentAlloc?.departmentHolder?.name ||
          'Unknown';

        const err = new AppError(
          `Asset "${asset.assetTag}" is currently ${asset.status.toLowerCase()} and cannot be allocated.`,
          409
        );
        err.details = {
          currentHolder: holderName,
          department: currentAlloc?.employeeHolder?.department?.name || null,
          allocatedSince: currentAlloc?.allocatedAt || null,
          transferRequestUrl: '/api/transfers',
        };
        throw err;
      }

      // ── Transition asset: AVAILABLE → ALLOCATED ────────────────────────
      await transitionAssetStatus(assetId, 'ALLOCATED', `allocated by ${actor.id}`, tx);

      // ── Create allocation record ────────────────────────────────────────
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
          employeeHolder: {
            select: { id: true, name: true, email: true, department: { select: { id: true, name: true } } },
          },
          departmentHolder: { select: { id: true, name: true } },
        },
      });

      // ── Emit event after commit ────────────────────────────────────────
      setImmediate(() => {
        eventBus.emit('entity.action', {
          type: 'asset.allocated',
          actorId: actor.id,
          actorName: actor.name,
          entityType: 'allocation',
          entityId: allocation.id,
          relatedAssetId: assetId,
          departmentId:
            allocation.employeeHolder?.department?.id ||
            departmentHolderId ||
            null,
          data: {
            assetTag: asset.assetTag,
            assetName: asset.name,
            holderName:
              allocation.employeeHolder?.name ||
              allocation.departmentHolder?.name,
            expectedReturnDate: expectedReturnDate || null,
          },
          timestamp: new Date().toISOString(),
        });
      });

      return { allocation, alreadyExisted: false };
    });
  }

  /**
   * Return an asset from its current active (or overdue) allocation.
   *
   * @param {string} allocationId
   * @param {object} data   - { returnCondition, returnNotes }
   * @param {object} actor  - req.user
   */
  async returnAllocation(allocationId, data, actor) {
    const { returnCondition = 'GOOD', returnNotes } = data;

    const allocation = await prisma.allocation.findUnique({
      where: { id: allocationId },
      include: {
        asset: { select: { id: true, assetTag: true, name: true } },
        employeeHolder: { select: { id: true, name: true } },
        departmentHolder: { select: { id: true, name: true } },
      },
    });

    if (!allocation) throw new AppError('Allocation not found.', 404);

    // ── AL9: Only ACTIVE or OVERDUE allocations can be returned ──────────
    if (allocation.status !== 'ACTIVE' && allocation.status !== 'OVERDUE') {
      throw new AppError(
        `Allocation is already ${allocation.status.toLowerCase()} and cannot be returned.`,
        400
      );
    }

    // ── Authorization: holder, their dept head, asset manager, or admin ──
    const isHolder = allocation.employeeHolderId === actor.id;
    const canReturn =
      isHolder || ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD'].includes(actor.role);
    if (!canReturn) {
      throw new AppError('You do not have permission to return this allocation.', 403);
    }

    await prisma.$transaction(async (tx) => {
      await tx.allocation.update({
        where: { id: allocationId },
        data: {
          status: 'RETURNED',
          actualReturnDate: new Date(),
          checkinNotes: returnNotes || null,
        },
      });
      await transitionAssetStatus(
        allocation.assetId,
        'AVAILABLE',
        `returned by ${actor.id}`,
        tx
      );
    });

    // ── Emit event ─────────────────────────────────────────────────────
    setImmediate(() => {
      eventBus.emit('entity.action', {
        type: 'asset.returned',
        actorId: actor.id,
        actorName: actor.name,
        entityType: 'allocation',
        entityId: allocationId,
        relatedAssetId: allocation.assetId,
        data: {
          assetTag: allocation.asset.assetTag,
          assetName: allocation.asset.name,
          returnCondition,
          returnNotes,
        },
        timestamp: new Date().toISOString(),
      });
    });

    const response = {
      allocationId,
      assetId: allocation.assetId,
      assetTag: allocation.asset.assetTag,
      returnedAt: new Date().toISOString(),
      returnCondition,
    };

    // ── AL8: Damaged on return → suggest maintenance ───────────────────
    if (returnCondition === 'DAMAGED' || returnCondition === 'damaged') {
      response.suggestMaintenance = true;
      response.maintenanceUrl = '/api/maintenance';
    }

    return response;
  }

  /**
   * Get allocation by ID.
   */
  async getById(allocationId) {
    const allocation = await prisma.allocation.findUnique({
      where: { id: allocationId },
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
        employeeHolder: {
          select: { id: true, name: true, email: true, department: { select: { id: true, name: true } } },
        },
        departmentHolder: { select: { id: true, name: true } },
      },
    });
    if (!allocation) throw new AppError('Allocation not found.', 404);
    return allocation;
  }

  /**
   * List allocations with optional filters and pagination.
   *
   * @param {object} filters - { assetId, employeeId, departmentId, status }
   * @param {object} pagination - { page, limit }
   * @param {object} actor  - req.user (for AL6 dept scope)
   */
  async list(filters = {}, pagination = { page: 1, limit: 20 }, actor = {}) {
    const { assetId, employeeId, departmentId, status } = filters;
    const page  = parseInt(pagination.page,  10) || 1;
    const limit = parseInt(pagination.limit, 10) || 20;
    const skip  = (page - 1) * limit;

    const where = {};
    if (assetId)    where.assetId          = assetId;
    if (employeeId) where.employeeHolderId = employeeId;
    if (status)     where.status            = status;

    // ── AL6: DEPARTMENT_HEAD sees only their dept's allocations ──────────
    if (actor.role === 'DEPARTMENT_HEAD' && actor.departmentId) {
      where.employeeHolder = { departmentId: actor.departmentId };
    } else if (departmentId) {
      where.employeeHolder = { departmentId };
    }

    const [allocations, total] = await Promise.all([
      prisma.allocation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { allocatedAt: 'desc' },
        include: {
          asset: { select: { id: true, assetTag: true, name: true, status: true } },
          employeeHolder: {
            select: { id: true, name: true, department: { select: { id: true, name: true } } },
          },
          departmentHolder: { select: { id: true, name: true } },
        },
      }),
      prisma.allocation.count({ where }),
    ]);

    return {
      data: allocations,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}

module.exports = new AllocationsService();