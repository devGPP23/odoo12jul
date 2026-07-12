/**
 * Dashboard Module — Service Layer.
 * KPIs computed via SQL aggregates, cached in Redis with short TTL.
 */

const { prisma } = require('../../config/postgres');
const { getRedisClient } = require('../../config/redis');

const KPI_CACHE_KEY = 'dashboard:kpis';
const KPI_TTL = 60; // 60 seconds

/**
 * Get dashboard KPIs — Redis cached.
 */
async function getKPIs() {
  // Try cache first
  const redis = getRedisClient();
  if (redis) {
    try {
      const cached = await redis.get(KPI_CACHE_KEY);
      if (cached) return JSON.parse(cached);
    } catch (err) {
      console.error('⚠️  Redis cache read failed:', err.message);
    }
  }

  // Cache miss — compute from Postgres
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const [
    assetsAvailable,
    assetsAllocated,
    assetsUnderMaintenance,
    totalAssets,
    maintenanceToday,
    activeBookings,
    pendingTransfers,
    upcomingReturns,
    overdueReturns,
  ] = await Promise.all([
    prisma.asset.count({ where: { status: 'AVAILABLE' } }),
    prisma.asset.count({ where: { status: 'ALLOCATED' } }),
    prisma.asset.count({ where: { status: 'UNDER_MAINTENANCE' } }),
    prisma.asset.count(),
    prisma.maintenanceRequest.count({
      where: {
        status: { in: ['APPROVED', 'TECHNICIAN_ASSIGNED', 'IN_PROGRESS'] },
        createdAt: { gte: todayStart, lte: todayEnd },
      },
    }),
    prisma.booking.count({
      where: {
        status: { in: ['UPCOMING', 'ONGOING'] },
      },
    }),
    prisma.transferRequest.count({ where: { status: 'REQUESTED' } }),
    prisma.allocation.count({
      where: {
        status: 'ACTIVE',
        expectedReturnDate: { gte: now },
        actualReturnDate: null,
      },
    }),
    prisma.allocation.count({
      where: {
        status: 'ACTIVE',
        expectedReturnDate: { lt: now },
        actualReturnDate: null,
      },
    }),
  ]);

  const kpis = {
    assetsAvailable,
    assetsAllocated,
    assetsUnderMaintenance,
    totalAssets,
    maintenanceToday,
    activeBookings,
    pendingTransfers,
    upcomingReturns,
    overdueReturns,
    computedAt: now.toISOString(),
  };

  // Cache in Redis
  if (redis) {
    try {
      await redis.set(KPI_CACHE_KEY, JSON.stringify(kpis), 'EX', KPI_TTL);
    } catch (err) {
      console.error('⚠️  Redis cache write failed:', err.message);
    }
  }

  return kpis;
}

/**
 * Get overdue allocations and bookings.
 */
async function getOverdue() {
  const now = new Date();

  const [overdueAllocations, overdueBookings] = await Promise.all([
    prisma.allocation.findMany({
      where: {
        status: 'ACTIVE',
        expectedReturnDate: { lt: now },
        actualReturnDate: null,
      },
      include: {
        asset: { select: { id: true, assetTag: true, name: true } },
        employeeHolder: { select: { id: true, name: true, email: true } },
        departmentHolder: { select: { id: true, name: true } },
      },
      orderBy: { expectedReturnDate: 'asc' },
    }),
    prisma.booking.findMany({
      where: {
        status: 'ONGOING',
        endTime: { lt: now },
      },
      include: {
        asset: { select: { id: true, assetTag: true, name: true } },
        bookedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { endTime: 'asc' },
    }),
  ]);

  return { overdueAllocations, overdueBookings };
}

module.exports = { getKPIs, getOverdue };
