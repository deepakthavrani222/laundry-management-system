const mongoose = require('mongoose');
const { SERVICES, CLOTHING_CATEGORIES, ITEM_TYPES } = require('../config/constants');

const orderItemSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  itemType: {
    type: String,
    enum: Object.values(ITEM_TYPES),
    required: true
  },
  service: {
    type: String,
    enum: Object.values(SERVICES),
    required: true
  },
  category: {
    type: String,
    enum: Object.values(CLOTHING_CATEGORIES),
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  // Pricing breakdown
  basePrice: {
    type: Number,
    required: true
  },
  serviceMultiplier: {
    type: Number,
    default: 1
  },
  categoryMultiplier: {
    type: Number,
    default: 1
  },
  expressMultiplier: {
    type: Number,
    default: 1
  },
  unitPrice: {
    type: Number,
    required: true
  },
  totalPrice: {
    type: Number,
    required: true
  },
  // Special instructions for this item
  specialInstructions: String,
  // Processing status
  processingStatus: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'quality_check', 'ready'],
    default: 'pending'
  },
  // Quality check
  qualityCheck: {
    passed: Boolean,
    notes: String,
    checkedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    checkedAt: Date
  },
  // Issues
  issues: [{
    type: {
      type: String,
      enum: ['stain_not_removed', 'damage', 'color_bleeding', 'shrinkage', 'other']
    },
    description: String,
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reportedAt: {
      type: Date,
      default: Date.now
    },
    resolved: {
      type: Boolean,
      default: false
    }
  }]
}, {
  timestamps: true
});

// Indexes
orderItemSchema.index({ order: 1 });
orderItemSchema.index({ processingStatus: 1 });

// Calculate total price
orderItemSchema.pre('save', function(next) {
  this.totalPrice = this.unitPrice * this.quantity;
  next();
});

module.exports = mongoose.model('OrderItem', orderItemSchema);