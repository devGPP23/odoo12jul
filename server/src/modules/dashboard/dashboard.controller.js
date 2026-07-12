const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const asyncHandler = require('../../utils/asyncHandler');
const { getRedisClient } = require('../../config/redis');

// 3B.6 - Dashboard ke KPI data laane ka function (Redis Cache ke saath)
exports.kpisDataLao = asyncHandler(async (req, res) => {
  const redisCache = getRedisClient();
  const cacheKey = 'dashboard:kpis';

  // Pehle Redis me check karte hai ki data hai kya
  const puranaData = await redisCache.get(cacheKey);
  if (puranaData) {
    // Cache Hit! Redis se seedha bhej do (fast ekdum)
    return res.status(200).json({
      success: true,
      cached: true,
      data: JSON.parse(puranaData)
    });
  }

  // Agar Redis khali hai, toh DB (Postgres) se lao
  const assetsKiGinti = await prisma.asset.groupBy({
    by: ['status'],
    _count: { id: true }
  });

  const chaluBookings = await prisma.booking.count({
    where: { status: { in: ['UPCOMING', 'ONGOING'] } }
  });

  const assetsKaResult = {
    AVAILABLE: 0,
    IN_USE: 0,
    UNDER_MAINTENANCE: 0,
    RETIRED: 0
  };

  assetsKiGinti.forEach((item) => {
    assetsKaResult[item.status] = item._count.id;
  });

  const nayaData = {
    assetStatusCounts: assetsKaResult,
    totalActiveBookings: chaluBookings
  };

  // DB se laane ke baad, Redis me 60 seconds (TTL) ke liye save kardo
  await redisCache.set(cacheKey, JSON.stringify(nayaData), 'EX', 60);

  res.status(200).json({
    success: true,
    cached: false,
    data: nayaData
  });
});

// 3B.7 - Overdue allocations laane ka function (Yeh real-time hoga, no cache)
exports.overdueLao = asyncHandler(async (req, res) => {
  const aajKiTaarikh = new Date();

  // Wo allocations lao jinka expectedReturnDate nikal gaya hai aur abhi tak lautaya nahi
  const overdueItems = await prisma.allocation.findMany({
    where: {
      status: 'ACTIVE',
      expectedReturnDate: {
        lt: aajKiTaarikh // less than now (time nikal gaya)
      }
    },
    include: {
      asset: { select: { name: true, assetTag: true } },
      employeeHolder: { select: { name: true, email: true } }
    },
    orderBy: { expectedReturnDate: 'asc' }
  });

  res.status(200).json({
    success: true,
    data: overdueItems
  });
});


