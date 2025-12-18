const Notification = require('../models/Notification');
const { NOTIFICATION_TYPES } = require('../config/constants');

class NotificationService {
  // Create and send notification
  static async createNotification({
    recipientId,
    type,
    title,
    message,
    data = {},
    channels = { inApp: true }
  }) {
    try {
      const notification = await Notification.createNotification({
        recipient: recipientId,
        type,
        title,
        message,
        data,
        channels
      });

      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  // Order-related notifications
  static async notifyOrderPlaced(customerId, order) {
    return this.createNotification({
      recipientId: customerId,
      type: NOTIFICATION_TYPES.ORDER_PLACED,
      title: 'Order Placed Successfully',
      message: `Your order ${order.orderNumber} has been placed successfully.`,
      data: { orderId: order._id }
    });
  }

  static async notifyOrderPicked(customerId, order) {
    return this.createNotification({
      recipientId: customerId,
      type: NOTIFICATION_TYPES.ORDER_PICKED,
      title: 'Order Picked Up',
      message: `Your order ${order.orderNumber} has been picked up and is on its way to our facility.`,
      data: { orderId: order._id }
    });
  }

  static async notifyOrderReady(customerId, order) {
    return this.createNotification({
      recipientId: customerId,
      type: NOTIFICATION_TYPES.ORDER_READY,
      title: 'Order Ready for Delivery',
      message: `Your order ${order.orderNumber} is ready and will be delivered soon.`,
      data: { orderId: order._id }
    });
  }

  static async notifyOrderOutForDelivery(customerId, order) {
    return this.createNotification({
      recipientId: customerId,
      type: NOTIFICATION_TYPES.ORDER_OUT_FOR_DELIVERY,
      title: 'Order Out for Delivery',
      message: `Your order ${order.orderNumber} is out for delivery and will reach you soon.`,
      data: { orderId: order._id }
    });
  }

  static async notifyOrderDelivered(customerId, order) {
    return this.createNotification({
      recipientId: customerId,
      type: NOTIFICATION_TYPES.ORDER_DELIVERED,
      title: 'Order Delivered',
      message: `Your order ${order.orderNumber} has been delivered successfully. Thank you for choosing our service!`,
      data: { orderId: order._id }
    });
  }

  // Branch notifications
  static async notifyNewOrderToBranch(branchManagerId, order) {
    return this.createNotification({
      recipientId: branchManagerId,
      type: NOTIFICATION_TYPES.ORDER_PLACED,
      title: 'New Order Assigned',
      message: `New order ${order.orderNumber} has been assigned to your branch.`,
      data: { orderId: order._id, branchId: order.branch }
    });
  }

  static async notifyLowInventory(branchManagerId, inventoryItem) {
    return this.createNotification({
      recipientId: branchManagerId,
      type: NOTIFICATION_TYPES.LOW_INVENTORY,
      title: 'Low Inventory Alert',
      message: `${inventoryItem.itemName} is running low. Current stock: ${inventoryItem.currentStock} ${inventoryItem.unit}`,
      data: { 
        branchId: inventoryItem.branch,
        inventoryItemId: inventoryItem._id
      }
    });
  }

  // Support notifications
  static async notifyNewComplaint(supportAgentId, ticket) {
    return this.createNotification({
      recipientId: supportAgentId,
      type: NOTIFICATION_TYPES.NEW_COMPLAINT,
      title: 'New Support Ticket',
      message: `New ticket ${ticket.ticketNumber} has been assigned to you.`,
      data: { ticketId: ticket._id }
    });
  }

  // Admin notifications
  static async notifyRefundRequest(adminId, order, amount) {
    return this.createNotification({
      recipientId: adminId,
      type: NOTIFICATION_TYPES.REFUND_REQUEST,
      title: 'Refund Request',
      message: `Refund request of ₹${amount} for order ${order.orderNumber} requires approval.`,
      data: { orderId: order._id }
    });
  }

  // Bulk notifications
  static async notifyMultipleUsers(userIds, notificationData) {
    const notifications = userIds.map(userId => ({
      ...notificationData,
      recipient: userId
    }));

    return Notification.insertMany(notifications);
  }

  // Get user notifications
  static async getUserNotifications(userId, { page = 1, limit = 20, unreadOnly = false } = {}) {
    const skip = (page - 1) * limit;
    const query = {
      recipient: userId,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gt: new Date() } }
      ]
    };

    if (unreadOnly) {
      query.isRead = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('data.orderId', 'orderNumber status')
        .populate('data.ticketId', 'ticketNumber status'),
      Notification.countDocuments(query),
      Notification.getUnreadCount(userId)
    ]);

    return {
      notifications,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit
      },
      unreadCount
    };
  }

  // Mark notifications as read
  static async markAsRead(userId, notificationIds) {
    const result = await Notification.updateMany(
      {
        _id: { $in: notificationIds },
        recipient: userId
      },
      {
        $set: {
          isRead: true,
          readAt: new Date()
        }
      }
    );

    return result;
  }

  // Mark all notifications as read
  static async markAllAsRead(userId) {
    const result = await Notification.updateMany(
      {
        recipient: userId,
        isRead: false
      },
      {
        $set: {
          isRead: true,
          readAt: new Date()
        }
      }
    );

    return result;
  }

  // Clean up expired notifications
  static async cleanupExpiredNotifications() {
    const result = await Notification.deleteMany({
      expiresAt: { $lt: new Date() }
    });

    console.log(`Cleaned up ${result.deletedCount} expired notifications`);
    return result;
  }
}

module.exports = NotificationService;