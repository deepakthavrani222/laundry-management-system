const express = require('express');
const {
  getNotifications,
  markNotificationsAsRead,
  markAllNotificationsAsRead,
  getUnreadCount
} = require('../../controllers/customer/notificationController');

const router = express.Router();

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.put('/mark-read', markNotificationsAsRead);
router.put('/mark-all-read', markAllNotificationsAsRead);

module.exports = router;