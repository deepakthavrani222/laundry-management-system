const mongoose = require('mongoose');
const { STAFF_ROLES } = require('../config/constants');

const staffSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Staff name is required'],
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    match: [/^[6-9]\d{9}$/, 'Please enter a valid 10-digit phone number']
  },
  role: {
    type: String,
    enum: Object.values(STAFF_ROLES),
    required: true
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Performance metrics
  performance: {
    ordersCompleted: {
      type: Number,
      default: 0
    },
    avgTimePerOrder: {
      type: Number,
      default: 0 // in minutes
    },
    rewashCount: {
      type: Number,
      default: 0
    },
    rating: {
      type: Number,
      default: 0
    },
    totalWorkingHours: {
      type: Number,
      default: 0
    }
  },
  // Current workload
  currentOrders: [{
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order'
    },
    assignedAt: Date,
    estimatedCompletion: Date
  }],
  // Availability
  availability: {
    isAvailable: {
      type: Boolean,
      default: true
    },
    maxOrdersPerDay: {
      type: Number,
      default: 20
    }
  }
}, {
  timestamps: true
});

// Indexes
staffSchema.index({ branch: 1, role: 1 });
staffSchema.index({ isActive: 1 });

// Check if staff is available for new orders
staffSchema.methods.isAvailableForWork = function() {
  return this.isActive && 
         this.availability.isAvailable && 
         this.currentOrders.length < this.availability.maxOrdersPerDay;
};

// Assign order to staff
staffSchema.methods.assignOrder = function(orderId, estimatedHours = 2) {
  this.currentOrders.push({
    order: orderId,
    assignedAt: new Date(),
    estimatedCompletion: new Date(Date.now() + estimatedHours * 60 * 60 * 1000)
  });
  return this.save();
};

// Complete order
staffSchema.methods.completeOrder = function(orderId) {
  this.currentOrders = this.currentOrders.filter(
    order => order.order.toString() !== orderId.toString()
  );
  this.performance.ordersCompleted += 1;
  return this.save();
};

module.exports = mongoose.model('Staff', staffSchema);