const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Branch name is required'],
    trim: true
  },
  code: {
    type: String,
    required: [true, 'Branch code is required'],
    unique: true,
    uppercase: true,
    trim: true
  },
  address: {
    addressLine1: { type: String, required: true },
    addressLine2: String,
    city: { type: String, required: true },
    pincode: { type: String, required: true },
    landmark: String
  },
  contact: {
    phone: { type: String, required: true },
    email: String
  },
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  capacity: {
    maxOrdersPerDay: {
      type: Number,
      default: 100
    },
    maxWeightPerDay: {
      type: Number,
      default: 500 // kg
    }
  },
  operatingHours: {
    openTime: {
      type: String,
      default: '09:00'
    },
    closeTime: {
      type: String,
      default: '18:00'
    },
    workingDays: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }]
  },
  serviceAreas: [{
    pincode: String,
    area: String,
    deliveryCharge: {
      type: Number,
      default: 0
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  // Holiday management
  holidays: [{
    date: Date,
    reason: String,
    isRecurring: {
      type: Boolean,
      default: false
    }
  }],
  // Performance metrics
  metrics: {
    totalOrders: {
      type: Number,
      default: 0
    },
    completedOrders: {
      type: Number,
      default: 0
    },
    averageRating: {
      type: Number,
      default: 0
    },
    totalRevenue: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Indexes
branchSchema.index({ code: 1 });
branchSchema.index({ 'serviceAreas.pincode': 1 });
branchSchema.index({ isActive: 1 });

// Check if branch is operational today
branchSchema.methods.isOperationalToday = function() {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'lowercase' });
  const isWorkingDay = this.operatingHours.workingDays.includes(today);
  
  // Check if today is a holiday
  const todayDate = new Date().toDateString();
  const isHoliday = this.holidays.some(holiday => 
    holiday.date.toDateString() === todayDate
  );
  
  return isWorkingDay && !isHoliday && this.isActive;
};

// Check capacity availability
branchSchema.methods.hasCapacity = function(additionalOrders = 1, additionalWeight = 0) {
  // This would need to be calculated based on today's orders
  // For now, returning true - will implement in service layer
  return true;
};

module.exports = mongoose.model('Branch', branchSchema);