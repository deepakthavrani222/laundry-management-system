const mongoose = require('mongoose');
const { ORDER_STATUS, PAYMENT_METHODS } = require('../config/constants');

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true,
    unique: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch'
  },
  // Pickup details
  pickupAddress: {
    name: String,
    phone: String,
    addressLine1: String,
    addressLine2: String,
    landmark: String,
    city: String,
    pincode: String
  },
  pickupDate: {
    type: Date,
    required: true
  },
  pickupTimeSlot: {
    type: String,
    required: true
  },
  // Delivery details
  deliveryAddress: {
    name: String,
    phone: String,
    addressLine1: String,
    addressLine2: String,
    landmark: String,
    city: String,
    pincode: String
  },
  estimatedDeliveryDate: Date,
  actualDeliveryDate: Date,
  // Order items
  items: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OrderItem'
  }],
  // Pricing
  pricing: {
    subtotal: {
      type: Number,
      required: true
    },
    expressCharge: {
      type: Number,
      default: 0
    },
    deliveryCharge: {
      type: Number,
      default: 0
    },
    discount: {
      type: Number,
      default: 0
    },
    tax: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      required: true
    }
  },
  // Payment
  paymentMethod: {
    type: String,
    enum: Object.values(PAYMENT_METHODS),
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentDetails: {
    transactionId: String,
    paidAt: Date
  },
  // Status tracking
  status: {
    type: String,
    enum: Object.values(ORDER_STATUS),
    default: ORDER_STATUS.PLACED
  },
  statusHistory: [{
    status: String,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    updatedAt: {
      type: Date,
      default: Date.now
    },
    notes: String
  }],
  // Logistics
  logisticsPartner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LogisticsPartner'
  },
  // Special instructions
  specialInstructions: String,
  // Staff assignment
  assignedStaff: [{
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff'
    },
    assignedAt: Date,
    completedAt: Date
  }],
  // Flags
  isExpress: {
    type: Boolean,
    default: false
  },
  isVIPOrder: {
    type: Boolean,
    default: false
  },
  isCancelled: {
    type: Boolean,
    default: false
  },
  cancellationReason: String,
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  cancelledAt: Date,
  // Rating
  rating: {
    score: {
      type: Number,
      min: 1,
      max: 5
    },
    feedback: String,
    ratedAt: Date
  },
  // Invoice
  invoiceGenerated: {
    type: Boolean,
    default: false
  },
  invoiceUrl: String
}, {
  timestamps: true
});

// Indexes
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ branch: 1, status: 1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ pickupDate: 1 });

// Generate order number
orderSchema.pre('save', async function(next) {
  if (!this.orderNumber) {
    const count = await mongoose.model('Order').countDocuments();
    this.orderNumber = `ORD${Date.now()}${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// Update status with history
orderSchema.methods.updateStatus = function(newStatus, updatedBy, notes = '') {
  this.status = newStatus;
  this.statusHistory.push({
    status: newStatus,
    updatedBy,
    updatedAt: new Date(),
    notes
  });
  return this.save();
};

// Check if order can be cancelled
orderSchema.methods.canBeCancelled = function() {
  const cancellableStatuses = [
    ORDER_STATUS.PLACED,
    ORDER_STATUS.ASSIGNED_TO_BRANCH,
    ORDER_STATUS.ASSIGNED_TO_LOGISTICS_PICKUP
  ];
  return cancellableStatuses.includes(this.status);
};

module.exports = mongoose.model('Order', orderSchema);