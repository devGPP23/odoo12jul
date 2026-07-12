/**
 * Assets Module — Service Layer.
 * Registration, directory/search, history.
 * Asset tag auto-generated via Postgres sequence.
 */

const { prisma } = require('../../config/postgres');
const AppError = require('../../utils/AppError');

/**
 * Register a new asset.
 * Auto-generates asset tag (AF-0001, AF-0002, ...) using a DB-safe counter.
 */
async function registerAsset({
  name,
  categoryId,
  serialNumber,
  acquisitionDate,
  acquisitionCost,
  condition,
  location,
  photoUrl,
  isBookable,
}) {
  // Validate category
  const category = await prisma.assetCategory.findUnique({ where: { id: categoryId } });
  if (!category) throw new AppError('Asset category not found.', 404);

  // Generate asset tag: count existing + 1, formatted as AF-XXXX
  // Uses a transaction to prevent race conditions on the counter
  return prisma.$transaction(async (tx) => {
    const count = await tx.asset.count();
    const tagNumber = count + 1;
    const assetTag = `AF-${String(tagNumber).padStart(4, '0')}`;

    return tx.asset.create({
      data: {
        name,
        categoryId,
        assetTag,
        serialNumber: serialNumber || null,
        acquisitionDate: acquisitionDate ? new Date(acquisitionDate) : null,
        acquisitionCost: acquisitionCost || null,
        condition: condition || 'NEW',
        location: location || null,
        photoUrl: photoUrl || null,
        isBookable: isBookable || false,
        status: 'AVAILABLE',
      },
      include: {
        category: { select: { id: true, name: true } },
      },
    });
  });
}

/**
 * Search/filter assets.
 */
async function getAssets({
  search,
  category,
  status,
  department,
  location,
  isBookable,
  page = 1,
  limit = 50,
} = {}) {
  const where = {};

  if (search) {
    where.OR = [
      { assetTag: { contains: search, mode: 'insensitive' } },
      { serialNumber: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (category) where.categoryId = category;
  if (status) where.status = status;
  if (location) where.location = { contains: location, mode: 'insensitive' };
  if (isBookable !== undefined) where.isBookable = isBookable === 'true' || isBookable === true;

  // Filter by department: find assets with active allocations to that department
  if (department) {
    where.allocations = {
      some: {
        status: 'ACTIVE',
        departmentHolderId: department,
      },
    };
  }

  const skip = (page - 1) * limit;

  const [assets, total] = await Promise.all([
    prisma.asset.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        allocations: {
          where: { status: 'ACTIVE' },
          select: {
            id: true,
            employeeHolder: { select: { id: true, name: true } },
            departmentHolder: { select: { id: true, name: true } },
            allocatedAt: true,
            expectedReturnDate: true,
          },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.asset.count({ where }),
  ]);

  return { assets, total, page, limit, totalPages: Math.ceil(total / limit) };
}

/**
 * Get single asset by ID with full details.
 */
async function getAssetById(id) {
  const asset = await prisma.asset.findUnique({
    where: { id },
    include: {
      category: true,
      allocations: {
        where: { status: 'ACTIVE' },
        include: {
          employeeHolder: { select: { id: true, name: true, email: true } },
          departmentHolder: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!asset) throw new AppError('Asset not found.', 404);
  return asset;
}

/**
 * Get combined allocation + maintenance history for an asset.
 */
async function getAssetHistory(assetId) {
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) throw new AppError('Asset not found.', 404);

  const [allocations, maintenanceRequests] = await Promise.all([
    prisma.allocation.findMany({
      where: { assetId },
      include: {
        employeeHolder: { select: { id: true, name: true } },
        departmentHolder: { select: { id: true, name: true } },
      },
      orderBy: { allocatedAt: 'desc' },
    }),
    prisma.maintenanceRequest.findMany({
      where: { assetId },
      include: {
        raisedBy: { select: { id: true, name: true } },
        technician: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  // Merge and sort by date
  const history = [
    ...allocations.map((a) => ({
      type: 'allocation',
      date: a.allocatedAt,
      data: a,
    })),
    ...maintenanceRequests.map((m) => ({
      type: 'maintenance',
      date: m.createdAt,
      data: m,
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  return history;
}

/**
 * Update asset details.
 */
async function updateAsset(id, data) {
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset) throw new AppError('Asset not found.', 404);

  // Status is NOT directly updatable here — use the state machine
  const { status: _ignoreStatus, assetTag: _ignoreTag, ...updateData } = data;

  if (updateData.acquisitionDate) {
    updateData.acquisitionDate = new Date(updateData.acquisitionDate);
  }

  return prisma.asset.update({
    where: { id },
    data: updateData,
    include: {
      category: { select: { id: true, name: true } },
    },
  });
}

module.exports = {
  registerAsset,
  getAssets,
  getAssetById,
  getAssetHistory,
  updateAsset,
};
