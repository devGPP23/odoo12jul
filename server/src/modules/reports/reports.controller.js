const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const asyncHandler = require('../../utils/asyncHandler');
 // KITNA ACCHE SE APAN UTILISE KAR RHE ISKA SARA SAAR IDHAR MILEGA APNE KO
// 4B.1 - GET /api/reports/utilization
// Most-used vs idle assets nikalenge
exports.utilizationLao = asyncHandler(async (req, res) => {
  // 1. Saare assets laao jinki bookings aur allocations hain
  const sabAssets = await prisma.asset.findMany({
    include: {
      bookings: true,
      allocations: true,
      category: true
    }
  });

  const teesDinPehleKaTime = new Date();
  teesDinPehleKaTime.setDate(teesDinPehleKaTime.getDate() - 30); // 30 din purana time

  let processedAssets = [];

  // 2. Har asset ka hisaab lagao
  sabAssets.forEach((asset) => {
    const bookingsKiGinti = asset.bookings.length;
    const allocationsKiGinti = asset.allocations.length;
    const totalUsage = bookingsKiGinti + allocationsKiGinti;

    let aakhriBaarKabUseHua = null;

    // Bookings se sabse latest date nikalo
    if (bookingsKiGinti > 0) {
      // Sort karke sabse naya nikal rahe hain
      const latestBooking = asset.bookings.sort((a, b) => b.createdAt - a.createdAt)[0];
      aakhriBaarKabUseHua = latestBooking.createdAt;
    }

    // Allocations se sabse latest date nikalo aur compare karo
    if (allocationsKiGinti > 0) {
      const latestAllocation = asset.allocations.sort((a, b) => b.createdAt - a.createdAt)[0];
      if (!aakhriBaarKabUseHua || latestAllocation.createdAt > aakhriBaarKabUseHua) {
        aakhriBaarKabUseHua = latestAllocation.createdAt;
      }
    }

    // Ab dekhte hai ki yeh IDLE hai ya nahi
    // Condition: Agar AVAILABLE hai, aur (ya toh kabhi use nahi hua YA 30 din se zyada ho gaye)
    let isIdle = false;
    if (asset.status === 'AVAILABLE') {
      if (totalUsage === 0) {
        isIdle = true;
      } else if (aakhriBaarKabUseHua && aakhriBaarKabUseHua < teesDinPehleKaTime) {
        isIdle = true;
      }
    }

    processedAssets.push({
      id: asset.id,
      name: asset.name,
      tag: asset.assetTag,
      category: asset.category?.name || 'Unknown',
      status: asset.status,
      totalUsage: totalUsage,
      isIdle: isIdle,
      lastUsedDate: aakhriBaarKabUseHua
    });
  });

  // 3. Most Used assets filter karo (jo idle nahi hai aur sabse zyada use hue hai)
  const mostUsed = processedAssets
    .filter(a => !a.isIdle && a.totalUsage > 0)
    .sort((a, b) => b.totalUsage - a.totalUsage)
    .slice(0, 10); // Top 10

  // 4. Idle assets filter karo
  const idleAssets = processedAssets.filter(a => a.isIdle);

  res.status(200).json({
    success: true,
    data: {
      mostUsed,
      idleAssets
    }
  });
});

// 4B.2 - GET /api/reports/maintenance-frequency
// Count of maintenance requests per asset, grouped by category
exports.maintenanceFrequencyLao = asyncHandler(async (req, res) => {
  // 1. Saare assets unki category aur maintenance requests ke saath laao
  const sabAssets = await prisma.asset.findMany({
    include: {
      category: true,
      maintenanceRequests: true
    }
  });

  const categoryKeHisaabSeData = {};

  // 2. Loop lagao sabpe
  sabAssets.forEach((asset) => {
    const catName = asset.category?.name || 'Uncategorized';
    const kharabiKiGinti = asset.maintenanceRequests.length;

    // Agar object me category nahi hai, toh add karo
    if (!categoryKeHisaabSeData[catName]) {
      categoryKeHisaabSeData[catName] = {
        category: catName,
        totalAssets: 0,
        totalMaintenanceIssues: 0,
        assets: [] // Isme detail rakhenge
      };
    }

    // Ab values jod do
    categoryKeHisaabSeData[catName].totalAssets += 1;
    categoryKeHisaabSeData[catName].totalMaintenanceIssues += kharabiKiGinti;

    // Agar kharab hua tha toh asset ki list me daal do record ke liye
    if (kharabiKiGinti > 0) {
      categoryKeHisaabSeData[catName].assets.push({
        name: asset.name,
        tag: asset.assetTag,
        issues: kharabiKiGinti
      });
    }
  });

  // Object ko array me convert karte hai frontend walo ke liye
  const finalResult = Object.values(categoryKeHisaabSeData);

  res.status(200).json({
    success: true,
    data: finalResult
  });
});

// 4B.3 - GET /api/reports/department-allocation
// Department ke hisaab se assets ka summary ki kiss department ne kaise allocation handle kara h

exports.departmentAllocationLao = asyncHandler(async (req, res) => {
  // 1. Saari active allocations laate hai
  const chaluAllocations = await prisma.allocation.findMany({
    where: { status: 'ACTIVE' },
    include: {
      departmentHolder: true,
      employeeHolder: {
        include: {
          department: true
        }
      }
    }
  });

  // Total system me kitne assets hain ye bhi nikal lete hain (ratio ke liye)
  const totalAssetsSystemMe = await prisma.asset.count();
  const abhiKaTime = new Date();
  
  const deptKeHisaabSeData = {};

  // 2. Loop lagate hain sabpe
  chaluAllocations.forEach((alloc) => {
    // Dept ka naam ya toh direct departmentHolder me hoga ya employee ki department me
    const deptName = alloc.departmentHolder?.name || alloc.employeeHolder?.department?.name || 'Bina Department Ke';

    if (!deptKeHisaabSeData[deptName]) {
      deptKeHisaabSeData[deptName] = {
        department: deptName,
        totalAllocated: 0,
        overdueCount: 0
      };
    }

    deptKeHisaabSeData[deptName].totalAllocated += 1;

    // Overdue check (kya return date nikal chuki hai?)
    if (alloc.expectedReturnDate && alloc.expectedReturnDate < abhiKaTime) {
      deptKeHisaabSeData[deptName].overdueCount += 1;
    }
  });

  // Object ko array me badalna
  const finalList = Object.values(deptKeHisaabSeData);

  res.status(200).json({
    success: true,
    data: {
      totalSystemAssets: totalAssetsSystemMe,
      departments: finalList
    }
  });
});

// 4B.4 - GET /api/reports/booking-heatmap
// Booking ke times ka heatmap nikalna (Peak usage windows)
exports.bookingHeatmapLao = asyncHandler(async (req, res) => {
  // 1. Saari bookings utha lo
  const saariBookings = await prisma.booking.findMany();

  // 2. Ek 7x24 ka grid banate hain. Days (0-6) x Hours (0-23)
  // Hardin me 24 ghante. Sabme 0 daal do pehle se.
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const grid = days.map(day => ({
    day: day,
    hours: new Array(24).fill(0)
  }));

  // 3. Har booking ka start time pakdo
  saariBookings.forEach((booking) => {
    const time = new Date(booking.startTime);
    const dayIndex = time.getDay(); // 0 for Sunday, 6 for Saturday
    const hour = time.getHours();   // 0 to 23

    // Us ghante ka count badha do
    grid[dayIndex].hours[hour] += 1;
  });

  res.status(200).json({
    success: true,
    data: grid
  });
});

// 4B.5 - GET /api/reports/export?type=utilization
// CSV Export karke dena
exports.exportCsvLao = asyncHandler(async (req, res) => {
  const type = req.query.type;

  if (type !== 'utilization') {
    return res.status(400).json({ success: false, message: 'Abhi sirf utilization export hota hai bhai' });
  }

  // Same logic jo 4B.1 me tha, usko chota sa yaha firse likh raha hu 
  // (taaki dono decoupled rahein aur CSV me clean array mile)
  const sabAssets = await prisma.asset.findMany({
    include: { bookings: true, allocations: true, category: true }
  });

  let csvContent = 'ID,Asset Name,Asset Tag,Category,Status,Total Usage\n';

  sabAssets.forEach(asset => {
    const totalUsage = asset.bookings.length + asset.allocations.length;
    const catName = asset.category?.name || 'Unknown';
    // CSV string banana manually jisse koi external dependency na lage (Aasan code)
    csvContent += `"${asset.id}","${asset.name}","${asset.assetTag}","${catName}","${asset.status}",${totalUsage}\n`;
  });

  // 3. Headers set karke file bhejo
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=asset-utilization-report.csv');
  
  res.send(csvContent);
});
