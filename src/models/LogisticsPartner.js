const mongoose = require('mongoose');

const logisticsPartnerSchema = new mongoose.Schema({
  companyName: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true
  },
  contactPerson: {
    name: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true,
      match: [/^[6-9]\d{9}$/, 'Please enter a valid 10-digit phone number']
    },
    email: String
  },
  coverageAreas: [{
    pincode: String,
    area: String,
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  sla: {
    pickupTime: {
      type: Number, // hours
      default: 2
    },
    deliveryTime: {
      type: Number, // hours
      default: 4
    }
  },
  rateCard: {
    perOrder: {
      type: Number,
      default: 0
    },
    perKm: {
      type: Number,
      default: 0
    },
    flatRate: {
      type: Number,
      default: 50
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Performance metrics
  performance: {
    totalOrders: {
      type: Number,
      default: 0
    },
    completedOrders: {
      type: Number,
      default: 0
    },
    averagePickupTime: {
      type: Number,
      default: 0
    },
    averageDeliveryTime: {
      type: Number,
      default: 0
    },
    rating: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Indexes
logisticsPartnerSchema.index({ 'coverageAreas.pincode': 1 });
logisticsPartnerSchema.index({ isActive: 1 });

// Check if partner covers a pincode
logisticsPartnerSchema.methods.coversPincode = function(pincode) {
  return this.coverageAreas.some(area => 
    area.pincode === pincode && area.isActive
  );
};

module.exports = mongoose.model('LogisticsPartner', logisticsPartnerSchema);