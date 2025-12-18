const mongoose = require('mongoose');
const { INVENTORY_ITEMS } = require('../config/constants');

const inventorySchema = new mongoose.Schema({
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  itemName: {
    type: String,
    enum: Object.values(INVENTORY_ITEMS),
    required: true
  },
  currentStock: {
    type: Number,
    required: true,
    min: 0
  },
  minThreshold: {
    type: Number,
    required: true,
    min: 0
  },
  maxCapacity: {
    type: Number,
    required: true
  },
  unit: {
    type: String,
    enum: ['liters', 'kg', 'pieces'],
    required: true
  },
  costPerUnit: {
    type: Number,
    required: true,
    min: 0
  },
  supplier: {
    name: String,
    contact: String,
    email: String
  },
  lastRestocked: {
    type: Date,
    default: Date.now
  },
  expiryDate: Date,
  // Consumption tracking
  consumptionHistory: [{
    date: {
      type: Date,
      default: Date.now
    },
    quantity: Number,
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order'
    },
    reason: {
      type: String,
      enum: ['order_processing', 'wastage', 'adjustment', 'restock'],
      default: 'order_processing'
    }
  }],
  // Alerts
  isLowStock: {
    type: Boolean,
    default: false
  },
  isExpired: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes
inventorySchema.index({ branch: 1, itemName: 1 }, { unique: true });
inventorySchema.index({ isLowStock: 1 });
inventorySchema.index({ expiryDate: 1 });

// Check if item is low stock
inventorySchema.methods.checkLowStock = function() {
  this.isLowStock = this.currentStock <= this.minThreshold;
  return this.isLowStock;
};

// Check if item is expired
inventorySchema.methods.checkExpiry = function() {
  if (this.expiryDate) {
    this.isExpired = new Date() > this.expiryDate;
  }
  return this.isExpired;
};

// Consume stock
inventorySchema.methods.consumeStock = function(quantity, orderId, reason = 'order_processing') {
  if (this.currentStock < quantity) {
    throw new Error('Insufficient stock');
  }
  
  this.currentStock -= quantity;
  this.consumptionHistory.push({
    quantity: -quantity,
    orderId,
    reason
  });
  
  this.checkLowStock();
  return this.save();
};

// Add stock (restock)
inventorySchema.methods.addStock = function(quantity, reason = 'restock') {
  this.currentStock += quantity;
  this.lastRestocked = new Date();
  this.consumptionHistory.push({
    quantity,
    reason
  });
  
  this.checkLowStock();
  return this.save();
};

// Pre-save middleware to check alerts
inventorySchema.pre('save', function(next) {
  this.checkLowStock();
  this.checkExpiry();
  next();
});

module.exports = mongoose.model('Inventory', inventorySchema);