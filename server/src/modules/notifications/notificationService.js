/**
 * Notification Service.
 * Writes to MongoDB and publishes to Redis for real-time push via Socket.io.
 *
 * Called as fire-and-forget AFTER Postgres transactions commit.
 * A missed notification is a UX papercut, not data corruption.
 */

const Notification = require('../../models/mongo/Notification');
const { getRedisPub } = require('../../config/redis');

/**
 * Send a notification to a user.
 * Non-blocking — errors are logged, never thrown.
 *
 * @param {object} params
 * @param {string} params.userId - Recipient employee ID
 * @param {string} params.type - Notification type enum
 * @param {string} params.message - Human-readable message
 * @param {string} [params.relatedEntityId] - ID of the related entity
 * @param {string} [params.relatedEntityType] - Type of the related entity
 * @param {object} [params.metadata] - Extra context
 */
async function sendNotification({
  userId,
  type,
  message,
  relatedEntityId = null,
  relatedEntityType = null,
  metadata = {},
}) {
  try {
    // 1. Write to MongoDB
    const notification = await Notification.create({
      userId,
      type,
      message,
      relatedEntityId,
      relatedEntityType,
      metadata,
    });

    // 2. Publish to Redis for real-time push
    try {
      const pub = getRedisPub();
      if (pub) {
        await pub.publish(
          `notifications:${userId}`,
          JSON.stringify({
            id: notification._id.toString(),
            type,
            message,
            relatedEntityId,
            relatedEntityType,
            metadata,
            createdAt: notification.createdAt,
          })
        );
      }
    } catch (redisErr) {
      // Redis pub/sub failure is non-critical — user will still see
      // the notification on next poll/page refresh
      console.error('⚠️  Redis publish failed (non-blocking):', redisErr.message);
    }

    return notification;
  } catch (err) {
    // Never throw — the calling Postgres transaction has already committed
    console.error('⚠️  Notification write failed (non-blocking):', err.message);
    return null;
  }
}

/**
 * Send notifications to multiple users.
 */
async function sendBulkNotifications(notifications) {
  return Promise.allSettled(
    notifications.map((n) => sendNotification(n))
  );
}

module.exports = { sendNotification, sendBulkNotifications };
