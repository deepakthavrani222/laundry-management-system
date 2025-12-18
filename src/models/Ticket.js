const mongoose = require('mongoose');
const { TICKET_STATUS, TICKET_PRIORITY, TICKET_CATEGORIES } = require('../config/constants');

const ticketSchema = new mongoose.Schema({
  ticketNumber: {
    type: String,
    required: true,
    unique: true
  },
  title: {
    type: String,
    required: [true, 'Ticket title is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Ticket description is required']
  },
  category: {
    type: String,
    enum: Object.values(TICKET_CATEGORIES),
    required: true
  },
  priority: {
    type: String,
    enum: Object.values(TICKET_PRIORITY),
    default: TICKET_PRIORITY.MEDIUM
  },
  status: {
    type: String,
    enum: Object.values(TICKET_STATUS),
    default: TICKET_STATUS.OPEN
  },
  // Relationships
  raisedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  relatedOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  // Resolution
  resolution: {
    type: String
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolvedAt: Date,
  // Escalation
  escalatedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  escalatedAt: Date,
  escalationReason: String,
  // Communication
  messages: [{
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    message: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    isInternal: {
      type: Boolean,
      default: false
    }
  }],
  // Attachments
  attachments: [{
    filename: String,
    url: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // SLA tracking
  sla: {
    responseTime: {
      type: Number, // hours
      default: 24
    },
    resolutionTime: {
      type: Number, // hours
      default: 48
    },
    firstResponseAt: Date,
    isOverdue: {
      type: Boolean,
      default: false
    }
  },
  // Customer satisfaction
  feedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    submittedAt: Date
  }
}, {
  timestamps: true
});

// Indexes
ticketSchema.index({ ticketNumber: 1 });
ticketSchema.index({ raisedBy: 1, createdAt: -1 });
ticketSchema.index({ assignedTo: 1, status: 1 });
ticketSchema.index({ status: 1, priority: 1 });
ticketSchema.index({ relatedOrder: 1 });

// Generate ticket number
ticketSchema.pre('save', async function(next) {
  if (!this.ticketNumber) {
    const count = await mongoose.model('Ticket').countDocuments();
    this.ticketNumber = `TKT${Date.now()}${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// Add message to ticket
ticketSchema.methods.addMessage = function(senderId, message, isInternal = false) {
  this.messages.push({
    sender: senderId,
    message,
    isInternal,
    timestamp: new Date()
  });
  
  // Update first response time if this is the first response from support
  if (!this.sla.firstResponseAt && isInternal) {
    this.sla.firstResponseAt = new Date();
  }
  
  return this.save();
};

// Escalate ticket
ticketSchema.methods.escalate = function(escalatedTo, reason) {
  this.escalatedTo = escalatedTo;
  this.escalatedAt = new Date();
  this.escalationReason = reason;
  this.status = TICKET_STATUS.ESCALATED;
  return this.save();
};

// Resolve ticket
ticketSchema.methods.resolve = function(resolvedBy, resolution) {
  this.status = TICKET_STATUS.RESOLVED;
  this.resolvedBy = resolvedBy;
  this.resolvedAt = new Date();
  this.resolution = resolution;
  return this.save();
};

// Check if ticket is overdue
ticketSchema.methods.checkOverdue = function() {
  const now = new Date();
  const createdAt = this.createdAt;
  const hoursSinceCreated = (now - createdAt) / (1000 * 60 * 60);
  
  if (this.status === TICKET_STATUS.OPEN && hoursSinceCreated > this.sla.responseTime) {
    this.sla.isOverdue = true;
  } else if (this.status === TICKET_STATUS.IN_PROGRESS && hoursSinceCreated > this.sla.resolutionTime) {
    this.sla.isOverdue = true;
  }
  
  return this.sla.isOverdue;
};

module.exports = mongoose.model('Ticket', ticketSchema);