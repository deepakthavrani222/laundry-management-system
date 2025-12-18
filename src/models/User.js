const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { USER_ROLES } = require('../config/constants');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    match: [/^[6-9]\d{9}$/, 'Please enter a valid 10-digit phone number']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  role: {
    type: String,
    enum: Object.values(USER_ROLES),
    default: USER_ROLES.CUSTOMER
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isVIP: {
    type: Boolean,
    default: false
  },
  // Customer specific fields
  addresses: [{
    name: String,
    phone: String,
    addressLine1: String,
    addressLine2: String,
    landmark: String,
    city: String,
    pincode: String,
    addressType: {
      type: String,
      enum: ['home', 'office', 'other'],
      default: 'home'
    },
    isDefault: {
      type: Boolean,
      default: false
    }
  }],
  preferences: {
    preferredPickupTime: String,
    savedServices: [String]
  },
  // Branch Manager specific fields
  assignedBranch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch'
  },
  // Rewards
  rewardPoints: {
    type: Number,
    default: 0
  },
  totalOrders: {
    type: Number,
    default: 0
  },
  // Timestamps
  lastLogin: Date,
  emailVerified: {
    type: Boolean,
    default: false
  },
  phoneVerified: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for performance
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ role: 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Update last login
userSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
  return this.save({ validateBeforeSave: false });
};

module.exports = mongoose.model('User', userSchema);