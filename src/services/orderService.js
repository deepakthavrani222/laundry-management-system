const Order = require('../models/Order');
const User = require('../models/User');
const Branch = require('../models/Branch');
const NotificationService = require('./notificationService');
const { ORDER_STATUS } = require('../config/constants');

class OrderService {
  // Update order status with notifications
  static async updateOrderStatus(orderId, newStatus, updatedBy, notes = '') {
    try {
      const order = await Order.findById(orderId)
        .populate('customer', '_id name')
        .populate('branch', 'manager');

      if (!order) {
        throw new Error('Order not found');
      }

      // Update order status
      await order.updateStatus(newStatus, updatedBy, notes);

      // Send notifications based on status
      await this.sendStatusNotifications(order, newStatus);

      return order;
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  }

  // Send notifications based on order status
  static async sendStatusNotifications(order, status) {
    try {
      const customerId = order.customer._id;

      switch (status) {
        case ORDER_STATUS.PLACED:
          await NotificationService.notifyOrderPlaced(customerId, order);
          break;

        case ORDER_STATUS.ASSIGNED_TO_BRANCH:
          // Notify customer
          await NotificationService.createNotification({
            recipientId: customerId,
            type: 'ORDER_ASSIGNED',
            title: 'Order Assigned to Branch',
            message: `Your order ${order.orderNumber} has been assigned to our processing facility.`,
            data: { orderId: order._id }
          });

          // Notify branch manager
          if (order.branch && order.branch.manager) {
            await NotificationService.notifyNewOrderToBranch(order.branch.manager, order);
          }
          break;

        case ORDER_STATUS.PICKED:
          await NotificationService.notifyOrderPicked(customerId, order);
          break;

        case ORDER_STATUS.IN_PROCESS:
          await NotificationService.createNotification({
            recipientId: customerId,
            type: 'ORDER_IN_PROCESS',
            title: 'Order Being Processed',
            message: `Your order ${order.orderNumber} is now being processed at our facility.`,
            data: { orderId: order._id }
          });
          break;

        case ORDER_STATUS.READY:
          await NotificationService.notifyOrderReady(customerId, order);
          break;

        case ORDER_STATUS.OUT_FOR_DELIVERY:
          await NotificationService.notifyOrderOutForDelivery(customerId, order);
          break;

        case ORDER_STATUS.DELIVERED:
          await NotificationService.notifyOrderDelivered(customerId, order);
          
          // Update customer stats
          await this.updateCustomerStats(customerId, order);
          break;

        case ORDER_STATUS.CANCELLED:
          await NotificationService.createNotification({
            recipientId: customerId,
            type: 'ORDER_CANCELLED',
            title: 'Order Cancelled',
            message: `Your order ${order.orderNumber} has been cancelled.`,
            data: { orderId: order._id }
          });
          break;
      }
    } catch (error) {
      console.error('Error sending status notifications:', error);
      // Don't throw error here as it shouldn't break the main flow
    }
  }

  // Update customer statistics after order completion
  static async updateCustomerStats(customerId, order) {
    try {
      const customer = await User.findById(customerId);
      if (!customer) return;

      // Add reward points for VIP customers
      if (customer.isVIP) {
        const points = Math.floor(order.pricing.total / 100); // 1 point per ₹100
        customer.rewardPoints += points;

        if (points > 0) {
          await NotificationService.createNotification({
            recipientId: customerId,
            type: 'REWARD_POINTS',
            title: 'Reward Points Earned',
            message: `You earned ${points} reward points for order ${order.orderNumber}!`,
            data: { orderId: order._id, pointsEarned: points }
          });
        }
      }

      // Update total orders count
      customer.totalOrders += 1;

      // Check for milestone achievements
      await this.checkMilestones(customer, order);

      await customer.save();
    } catch (error) {
      console.error('Error updating customer stats:', error);
    }
  }

  // Check and notify about customer milestones
  static async checkMilestones(customer, order) {
    const milestones = [5, 10, 25, 50, 100];
    
    if (milestones.includes(customer.totalOrders)) {
      await NotificationService.createNotification({
        recipientId: customer._id,
        type: 'MILESTONE_ACHIEVED',
        title: 'Milestone Achieved!',
        message: `Congratulations! You've completed ${customer.totalOrders} orders with us. Thank you for your loyalty!`,
        data: { milestone: customer.totalOrders }
      });

      // Auto-upgrade to VIP after 25 orders
      if (customer.totalOrders >= 25 && !customer.isVIP) {
        customer.isVIP = true;
        
        await NotificationService.createNotification({
          recipientId: customer._id,
          type: 'VIP_UPGRADE',
          title: 'Welcome to VIP!',
          message: 'You are now a VIP customer! Enjoy priority processing, special discounts, and reward points on every order.',
          data: { upgradedAt: new Date() }
        });
      }
    }
  }

  // Get order analytics for dashboard
  static async getOrderAnalytics(branchId = null, startDate = null, endDate = null) {
    try {
      const query = {};
      if (branchId) query.branch = branchId;
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      const [
        totalOrders,
        completedOrders,
        cancelledOrders,
        totalRevenue,
        averageOrderValue,
        statusDistribution
      ] = await Promise.all([
        Order.countDocuments(query),
        Order.countDocuments({ ...query, status: ORDER_STATUS.DELIVERED }),
        Order.countDocuments({ ...query, status: ORDER_STATUS.CANCELLED }),
        Order.aggregate([
          { $match: { ...query, status: ORDER_STATUS.DELIVERED } },
          { $group: { _id: null, total: { $sum: '$pricing.total' } } }
        ]).then(result => result[0]?.total || 0),
        Order.aggregate([
          { $match: { ...query, status: ORDER_STATUS.DELIVERED } },
          { $group: { _id: null, avg: { $avg: '$pricing.total' } } }
        ]).then(result => Math.round(result[0]?.avg || 0)),
        Order.aggregate([
          { $match: query },
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ])
      ]);

      return {
        totalOrders,
        completedOrders,
        cancelledOrders,
        totalRevenue,
        averageOrderValue,
        statusDistribution,
        completionRate: totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0
      };
    } catch (error) {
      console.error('Error getting order analytics:', error);
      throw error;
    }
  }

  // Get orders requiring attention (delayed, stuck, etc.)
  static async getOrdersRequiringAttention(branchId = null) {
    try {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const query = {
        status: { 
          $nin: [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED] 
        },
        createdAt: { $lt: twoDaysAgo }
      };

      if (branchId) query.branch = branchId;

      const delayedOrders = await Order.find(query)
        .populate('customer', 'name phone')
        .populate('branch', 'name code')
        .sort({ createdAt: 1 })
        .limit(20);

      return delayedOrders;
    } catch (error) {
      console.error('Error getting orders requiring attention:', error);
      throw error;
    }
  }
}

module.exports = OrderService;