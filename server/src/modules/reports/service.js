/**
 * Reports Module — Service Layer.
 * Read-only aggregate queries for analytics.
 */

const { prisma } = require('../../config/postgres');

/**
 * Asset utilization: most-used vs idle assets based on allocation count.
 */
async function getUtilization() {
  const assets = await prisma.asset.findMany({
    where: { status: { notIn: ['DISPOSED'] } },
    include: {
      category: { select: { name: true } },
      _count: {
        select: {
          allocations: true,
          bookings: true,
          maintenanceRequests: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Sort by total usage (allocations + bookings)
  const sorted = assets
    .map((a) => ({
      id: a.id,
      assetTag: a.assetTag,
      name: a.name,
      category: a.category.name,
      status: a.status,
      totalAllocations: a._count.allocations,
      totalBookings: a._count.bookings,
      totalUsage: a._count.allocations + a._count.bookings,
    }))
    .sort((a, b) => b.totalUsage - a.totalUsage);

  return {
    mostUsed: sorted.slice(0, 10),
    idle: sorted.filter((a) => a.totalUsage === 0),
    total: sorted.length,
  };
}

/**
 * Maintenance frequency by asset and category.
 */
async function getMaintenanceFrequency() {
  const byAsset = await prisma.maintenanceRequest.groupBy({
    by: ['assetId'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 20,
  });

  // Enrich with asset details
  const assetIds = byAsset.map((b) => b.assetId);
  const assets = await prisma.asset.findMany({
    where: { id: { in: assetIds } },
    include: { category: { select: { name: true } } },
  });

  const assetMap = new Map(assets.map((a) => [a.id, a]));

  const enriched = byAsset.map((b) => {
    const asset = assetMap.get(b.assetId);
    return {
      assetId: b.assetId,
      assetTag: asset?.assetTag,
      assetName: asset?.name,
      category: asset?.category?.name,
      maintenanceCount: b._count.id,
    };
  });

  return enriched;
}

/**
 * Department-wise allocation summary.
 */
async function getDepartmentAllocationSummary() {
  const departments = await prisma.department.findMany({
    where: { status: 'ACTIVE' },
    include: {
      _count: { select: { employees: true } },
      departmentAllocations: {
        where: { status: 'ACTIVE' },
        include: {
          asset: { select: { id: true, assetTag: true, name: true, status: true } },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  // Also count employee-held allocations per department
  const employeeAllocations = await prisma.allocation.findMany({
    where: { status: 'ACTIVE', employeeHolderId: { not: null } },
    include: {
      employeeHolder: { select: { departmentId: true } },
      asset: { select: { id: true } },
    },
  });

  const deptEmployeeAllocationCount = new Map();
  for (const alloc of employeeAllocations) {
    const deptId = alloc.employeeHolder?.departmentId;
    if (deptId) {
      deptEmployeeAllocationCount.set(deptId, (deptEmployeeAllocationCount.get(deptId) || 0) + 1);
    }
  }

  return departments.map((d) => ({
    departmentId: d.id,
    departmentName: d.name,
    employeeCount: d._count.employees,
    directDepartmentAllocations: d.departmentAllocations.length,
    employeeAllocations: deptEmployeeAllocationCount.get(d.id) || 0,
    totalAllocations: d.departmentAllocations.length + (deptEmployeeAllocationCount.get(d.id) || 0),
  }));
}

/**
 * Booking heatmap — bookings per hour of day per day of week.
 */
async function getBookingHeatmap() {
  const bookings = await prisma.booking.findMany({
    where: { status: { in: ['UPCOMING', 'ONGOING', 'COMPLETED'] } },
    select: { startTime: true, endTime: true },
  });

  // Build heatmap: [dayOfWeek][hourOfDay] = count
  const heatmap = Array.from({ length: 7 }, () => Array(24).fill(0));

  for (const booking of bookings) {
    const start = new Date(booking.startTime);
    const day = start.getDay();
    const hour = start.getHours();
    heatmap[day][hour]++;
  }

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return heatmap.map((hours, dayIndex) => ({
    day: dayNames[dayIndex],
    hours: hours.map((count, hour) => ({ hour, count })),
  }));
}

module.exports = {
  getUtilization,
  getMaintenanceFrequency,
  getDepartmentAllocationSummary,
  getBookingHeatmap,
};
