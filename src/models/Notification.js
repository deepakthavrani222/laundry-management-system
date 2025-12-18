const mongoose = require('mongoose');
const { NOTIFICATION_TYPES } = require('../config/constants');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: Object.values(NOTIFICATION_TYPES),
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  data: {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order'
    },
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket'
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch'
    },
    // Additional data as needed
    additionalData: mongoose.Schema.Types.Mixed
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  // Delivery channels
  channels: {
    inApp: {
      type: Boolean,
      default: true
    },
    email: {
      type: Boolean,
      default: false
    },
    sms: {
      type: Boolean,
      default: false
    },
    push: {
      type: Boolean,
      default: false
    }
  },
  // Delivery status
  deliveryStatus: {
    inApp: {
      delivered: { type: Boolean, default: false },
      deliveredAt: Date
    },
    email: {
      delivered: { type: Boolean, default: false },
      deliveredAt: Date,
      error: String
    },
    sms: {
      delivered: { type: Boolean, default: false },
      deliveredAt: Date,
      error: String
    },
    push: {
      delivered: { type: Boolean, default: false },
      deliveredAt: Date,
      error: String
    }
  },
  // Scheduling
  scheduledFor: Date,
  expiresAt: Date
}, {
  timestamps: true
});

// Indexes
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ scheduledFor: 1 });
notificationSchema.index({ expiresAt: 1 });

// Mark as read
notificationSchema.methods.markAsRead = function() {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

// Check if notification is expired
notificationSchema.methods.isExpired = function() {
  return this.expiresAt && new Date() > this.expiresAt;
};

// Static method to create notification
notificationSchema.statics.createNotification = async function(data) {
  const notification = new this(data);
  
  // Set default expiry (30 days)
  if (!notification.expiresAt) {
    notification.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }
  
  await notification.save();
  
  // TODO: Trigger actual delivery based on channels
  // This would integrate with email service, SMS service, push notification service
  
  return notification;
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({
    recipient: userId,
    isRead: false,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } }
    ]
  });
};

module.exports = mongoose.model('Notification', notificationSchema);