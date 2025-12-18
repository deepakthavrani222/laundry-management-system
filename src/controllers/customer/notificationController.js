const NotificationService = require('../../services/notificationService');
const { sendSuccess, sendError, asyncHandler } = require('../../utils/helpers');

// @desc    Get customer notifications
// @route   GET /api/customer/notifications
// @access  Private (Customer)
const getNotifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, unreadOnly } = req.query;
  
  const result = await NotificationService.getUserNotifications(req.user._id, {
    page: parseInt(page),
    limit: parseInt(limit),
    unreadOnly: unreadOnly === 'true'
  });

  sendSuccess(res, result, 'Notifications retrieved successfully');
});

// @desc    Get unread notification count
// @route   GET /api/customer/notifications/unread-count
// @access  Private (Customer)
const getUnreadCount = asyncHandler(async (req, res) => {
  const unreadCount = await NotificationService.getUserNotifications(req.user._id, {
    page: 1,
    limit: 1
  }).then(result => result.unreadCount);

  sendSuccess(res, { unreadCount }, 'Unread count retrieved successfully');
});

// @desc    Mark notifications as read
// @route   PUT /api/customer/notifications/mark-read
// @access  Private (Customer)
const markNotificationsAsRead = asyncHandler(async (req, res) => {
  const { notificationIds } = req.body;

  if (!notificationIds || !Array.isArray(notificationIds)) {
    return sendError(res, 'INVALID_DATA', 'Notification IDs array is required', 400);
  }

  await NotificationService.markAsRead(req.user._id, notificationIds);

  sendSuccess(res, null, 'Notifications marked as read');
});

// @desc    Mark all notifications as read
// @route   PUT /api/customer/notifications/mark-all-read
// @access  Private (Customer)
const markAllNotificationsAsRead = asyncHandler(async (req, res) => {
  await NotificationService.markAllAsRead(req.user._id);

  sendSuccess(res, null, 'All notifications marked as read');
});

module.exports = {
  getNotifications,
  getUnreadCount,
  markNotificationsAsRead,
  markAllNotificationsAsRead
};