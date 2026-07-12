const ActivityLog = require('../../models/mongo/ActivityLog');
const asyncHandler = require('../../utils/asyncHandler');

// 3B.13 - Saari activities laane ka function (Pagination & Filtering ke saath)
exports.activitiesLao = asyncHandler(async (req, res) => {
  const pannaNumber = parseInt(req.query.page) || 1;
  const ekPanneParKitne = parseInt(req.query.limit) || 20;
  
  const chhodneWaleItems = (pannaNumber - 1) * ekPanneParKitne;

  // Filter banana (agar action ya user kisa search ho)
  const filter = {};
  if (req.query.action) {
    filter.action = req.query.action;
  }
  if (req.query.entityType) {
    filter.entityType = req.query.entityType;
  }

  // MongoDB se fetch karte hai
  const saariActivities = await ActivityLog.find(filter)
    .sort({ createdAt: -1 }) // Sabse naye sabse upar
    .skip(chhodneWaleItems)
    .limit(ekPanneParKitne);

  const totalGinti = await ActivityLog.countDocuments(filter);

  res.status(200).json({
    success: true,
    data: saariActivities,
    pagination: {
      page: pannaNumber,
      limit: ekPanneParKitne,
      total: totalGinti,
      totalPages: Math.ceil(totalGinti / ekPanneParKitne)
    }
  });
});
