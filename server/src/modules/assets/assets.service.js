const { prisma } = require('../../config/postgres');
const AppError = require('../../utils/AppError');
const eventBus = require('../../core/eventBus'); // Naya event bhejne ke liye laaye hain


// YAHA APAN SARE CRUD OPERATION KAR RHE  ASSETS PE 

//Register a new asset with auto-generated asset tag.
exports.registerAsset = async (assetData) => {
  let nextTagNum;
  try {
    const result = await prisma.$queryRaw`SELECT nextval('asset_tag_seq') as val`;
    // Depending on postgres driver, result might be an array of objects
    const val = result[0]?.val || result[0]?.nextval;
    // Format tag like AF-0001
    nextTagNum = `AF-${String(val).padStart(4, '0')}`;
  } catch (error) {
    // Fallback 
    const count = await prisma.asset.count();
    nextTagNum = `AF-${String(count + 1).padStart(4, '0')}`;
  }

  const newAsset = await prisma.asset.create({
    data: {
      ...assetData,
      assetTag: nextTagNum,
      status: 'AVAILABLE', // from AssetStatus enum
    },
    include: {
      category: true,
      department: true
    }
  });

  // Naya event bhej diya notification aur activity log ke liye
  const nayaAssetData = {
    type: 'asset.registered',
    actorName: 'SystemAdmin', // aage chalke real user aayega
    entityType: 'asset',
    entityId: newAsset.id,
    data: newAsset,
    timestamp: new Date().toISOString()
  };
  eventBus.emit('entity.action', nayaAssetData);

  return newAsset;
};


 //Get assets with search, filter, and pagination
 
exports.getAssets = async (filters, page = 1, limit = 20) => {
  const { tag, serial, categoryId, status, departmentId, location, search } = filters;

  const where = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { assetTag: { contains: search, mode: 'insensitive' } },
      { serialNumber: { contains: search, mode: 'insensitive' } }
    ];
  }

      if (tag) where.assetTag = { contains: tag, mode: 'insensitive' };
      if (serial) where.serialNumber = { contains: serial, mode: 'insensitive' };
      if (categoryId) where.categoryId = categoryId;
      if (status) where.status = status;
      if (location) where.location = { contains: location, mode: 'insensitive' };
    
      const skip = (page - 1) * limit;
    
      const [data, total] = await Promise.all([
        prisma.asset.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { createdAt: 'desc' },
          include: {
            category: true
          }
        }),
    prisma.asset.count({ where })
  ]);

  return {
    data,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get single asset by ID
 */
exports.getAssetById = async (assetId) => {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: {
      category: true,
      department: true
    }
  });

  if (!asset) {
    throw new AppError('Asset not found', 404);
  }

  return asset;
};

/**
 * Update asset
 */
exports.updateAsset = async (assetId, updateData) => {
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) throw new AppError('Asset not found', 404);

  const updatedAsset = await prisma.asset.update({
    where: { id: assetId },
    data: updateData,
    include: {
      category: true,
      department: true
    }
  });

  // Jab bhi asset update ho, ye event fire karenge
  const updateKaData = {
    type: 'asset.updated',
    actorName: 'SystemAdmin', 
    entityType: 'asset',
    entityId: updatedAsset.id,
    data: updatedAsset,
    timestamp: new Date().toISOString()
  };
  eventBus.emit('entity.action', updateKaData);

  return updatedAsset;
};


 // Delete asset
 
exports.deleteAsset = async (assetId) => {
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) throw new AppError('Asset not found', 404);

  await prisma.asset.delete({ where: { id: assetId } });

  // Delete hone pe bhi event nikal denge
  const deleteKaData = {
    type: 'asset.deleted',
    actorName: 'SystemAdmin', 
    entityType: 'asset',
    entityId: assetId,
    data: { deletedAssetTag: asset.assetTag },
    timestamp: new Date().toISOString()
  };
  eventBus.emit('entity.action', deleteKaData);

  return { message: 'Asset deleted successfully' };
};


// Prisma se us asset ke saare allocations (kis-kis ko mila) aur maintenance (kab-kab theek hone gaya) ka data fetch kiya.
// Dono ko ek single array (history) mein mila (combine/UNION) diya.



//  Asset History Endpoint Logic = 
exports.getAssetHistory = async (assetId) => {
  // Check if asset exists
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) throw new AppError('Asset not found', 404);

  // Fetch Allocations
  const allocations = await prisma.allocation.findMany({
    where: { assetId },
    include: {
      employeeHolder: { select: { id: true, name: true, email: true } },
      departmentHolder: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' }
  });

  // Fetch Maintenance Records
  const maintenance = await prisma.maintenanceRequest.findMany({
    where: { assetId },
    include: {
      raisedBy: { select: { id: true, name: true } },
      technician: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Combine and format data
  const history = [
    ...allocations.map(a => ({
      id: a.id,
      type: 'ALLOCATION',
      status: a.status,
      date: a.createdAt,
      details: a.employeeHolder ? `Assigned to Employee: ${a.employeeHolder.name}` : `Assigned to Dept: ${a.departmentHolder?.name}`,
      raw: a
    })),
    ...maintenance.map(m => ({
      id: m.id,
      type: 'MAINTENANCE',
      status: m.status,
      date: m.createdAt,
      details: `Maintenance Issue: ${m.issueDescription}`,
      raw: m
    }))
  ];

  // Sort combined array by date descending
  history.sort((a, b) => new Date(b.date) - new Date(a.date));

  return history;
};
