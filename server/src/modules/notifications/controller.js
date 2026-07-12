/**
 * Notifications Module — Controller.
 * Reads from MongoDB.
 */

const asyncHandler = require('../../utils/asyncHandler');
const Notification = require('../../models/mongo/Notification');

const getNotifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, unreadOnly } = req.query;
  const skip = (page - 1) * limit;

  const filter = { userId: req.user.id };
  if (unreadOnly === 'true') filter.read = false;

  const [notifications, total] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .lean(),
    Notification.countDocuments(filter),
  ]);

  const unreadCount = await Notification.countDocuments({ userId: req.user.id, read: false });

  res.json({
    success: true,
    data: {
      notifications,
      unreadCount,
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(total / limit),
    },
  });
});

const markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { read: true },
    { new: true }
  );

  if (!notification) {
    return res.status(404).json({ success: false, message: 'Notification not found.' });
  }

  res.json({ success: true, data: notification });
});

const markAllAsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { userId: req.user.id, read: false },
    { read: true }
  );
  res.json({ success: true, message: 'All notifications marked as read.' });
});

module.exports = { getNotifications, markAsRead, markAllAsRead };
