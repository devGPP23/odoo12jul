const Notification = require('../../models/mongo/Notification');
const AppError = require('../../utils/AppError');
const asyncHandler = require('../../utils/asyncHandler');

// 3B.3 - Notifications lane ka function (paginated, sorted by latest)
exports.sabNotificationsLao = asyncHandler(async (req, res) => {
  // Paging ke variables (shuruwat mein kitne laane hai)
  const pannaNumber = parseInt(req.query.page) || 1;
  const ekPanneParKitne = parseInt(req.query.limit) || 20;
  
  // Dummy user jab tak auth nahi banta, real app me req.user.id hoga
  const userKaId = req.user?.id || 'dummy-user-id';

  const chhodneWaleItems = (pannaNumber - 1) * ekPanneParKitne;

  // MongoDB se query maari (sabse naye wale pehle aayenge - createdAt desc)
  const mereNotifications = await Notification.find({ userId: userKaId })
    .sort({ createdAt: -1 }) 
    .skip(chhodneWaleItems)
    .limit(ekPanneParKitne);

  const totalGinti = await Notification.countDocuments({ userId: userKaId });

  res.status(200).json({
    success: true,
    data: mereNotifications,
    pagination: {
      page: pannaNumber,
      limit: ekPanneParKitne,
      total: totalGinti,
      totalPages: Math.ceil(totalGinti / ekPanneParKitne)
    }
  });
});

// Ek notification ko read mark karne ka function
exports.ekNotificationReadKaro = asyncHandler(async (req, res) => {
  const notificationId = req.params.id;
  
  const updateHua = await Notification.findByIdAndUpdate(
    notificationId,
    { read: true },
    { new: true } // updated wala document return karega
  );

  if (!updateHua) {
    throw new AppError('Notification mila nahi bhai', 404);
  }

  res.status(200).json({
    success: true,
    data: updateHua
  });
});

// Saare notifications ek saath read mark karne ka function
exports.sabReadKardo = asyncHandler(async (req, res) => {
  const userKaId = req.user?.id || 'dummy-user-id';

  await Notification.updateMany(
    { userId: userKaId, read: false },
    { $set: { read: true } }
  );

  res.status(200).json({
    success: true,
    message: 'Saare notifications read mark ho gaye hai'
  });
});
