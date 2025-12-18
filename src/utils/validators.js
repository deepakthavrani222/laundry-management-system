const Joi = require('joi');
const { USER_ROLES, SERVICES, CLOTHING_CATEGORIES, ITEM_TYPES, TICKET_CATEGORIES, TICKET_PRIORITY } = require('../config/constants');

// Common validation schemas
const commonSchemas = {
  objectId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).message('Invalid ID format'),
  phone: Joi.string().regex(/^[6-9]\d{9}$/).message('Please enter a valid 10-digit phone number'),
  email: Joi.string().email().lowercase(),
  password: Joi.string().min(6).message('Password must be at least 6 characters'),
  pincode: Joi.string().regex(/^[1-9][0-9]{5}$/).message('Please enter a valid 6-digit pincode')
};

// Auth validation schemas
const authValidation = {
  register: Joi.object({
    name: Joi.string().trim().min(2).max(50).required(),
    email: commonSchemas.email.required(),
    phone: commonSchemas.phone.required(),
    password: commonSchemas.password.required(),
    role: Joi.string().valid(...Object.values(USER_ROLES)).default(USER_ROLES.CUSTOMER)
  }),

  login: Joi.object({
    email: commonSchemas.email,
    phone: commonSchemas.phone,
    password: Joi.string().required()
  }).xor('email', 'phone'),

  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: commonSchemas.password.required()
  })
};

// User validation schemas
const userValidation = {
  updateProfile: Joi.object({
    name: Joi.string().trim().min(2).max(50),
    email: commonSchemas.email,
    phone: commonSchemas.phone,
    preferences: Joi.object({
      preferredPickupTime: Joi.string(),
      savedServices: Joi.array().items(Joi.string().valid(...Object.values(SERVICES)))
    })
  }),

  addAddress: Joi.object({
    name: Joi.string().trim().required(),
    phone: commonSchemas.phone.required(),
    addressLine1: Joi.string().trim().required(),
    addressLine2: Joi.string().trim().allow(''),
    landmark: Joi.string().trim().allow(''),
    city: Joi.string().trim().required(),
    pincode: commonSchemas.pincode.required(),
    addressType: Joi.string().valid('home', 'office', 'other').default('home'),
    isDefault: Joi.boolean().default(false)
  })
};

// Order validation schemas
const orderValidation = {
  createOrder: Joi.object({
    items: Joi.array().items(
      Joi.object({
        itemType: Joi.string().valid(...Object.values(ITEM_TYPES)).required(),
        service: Joi.string().valid(...Object.values(SERVICES)).required(),
        category: Joi.string().valid(...Object.values(CLOTHING_CATEGORIES)).required(),
        quantity: Joi.number().integer().min(1).required(),
        specialInstructions: Joi.string().trim().allow('')
      })
    ).min(1).required(),
    pickupAddressId: commonSchemas.objectId.required(),
    deliveryAddressId: commonSchemas.objectId.required(),
    pickupDate: Joi.date().min('now').required(),
    pickupTimeSlot: Joi.string().required(),
    paymentMethod: Joi.string().valid('online', 'cod').required(),
    isExpress: Joi.boolean().default(false),
    specialInstructions: Joi.string().trim().allow('')
  }),

  updateOrderStatus: Joi.object({
    status: Joi.string().required(),
    notes: Joi.string().trim().allow('')
  }),

  assignOrder: Joi.object({
    branchId: commonSchemas.objectId,
    logisticsPartnerId: commonSchemas.objectId,
    staffId: commonSchemas.objectId
  }),

  rateOrder: Joi.object({
    score: Joi.number().integer().min(1).max(5).required(),
    feedback: Joi.string().trim().allow('')
  })
};

// Branch validation schemas
const branchValidation = {
  createBranch: Joi.object({
    name: Joi.string().trim().required(),
    code: Joi.string().trim().uppercase().required(),
    address: Joi.object({
      addressLine1: Joi.string().trim().required(),
      addressLine2: Joi.string().trim().allow(''),
      city: Joi.string().trim().required(),
      pincode: commonSchemas.pincode.required(),
      landmark: Joi.string().trim().allow('')
    }).required(),
    contact: Joi.object({
      phone: commonSchemas.phone.required(),
      email: commonSchemas.email
    }).required(),
    managerId: commonSchemas.objectId,
    capacity: Joi.object({
      maxOrdersPerDay: Joi.number().integer().min(1).default(100),
      maxWeightPerDay: Joi.number().min(1).default(500)
    }),
    serviceAreas: Joi.array().items(
      Joi.object({
        pincode: commonSchemas.pincode.required(),
        area: Joi.string().trim().required(),
        deliveryCharge: Joi.number().min(0).default(0)
      })
    )
  }),

  updateBranch: Joi.object({
    name: Joi.string().trim(),
    address: Joi.object({
      addressLine1: Joi.string().trim(),
      addressLine2: Joi.string().trim().allow(''),
      city: Joi.string().trim(),
      pincode: commonSchemas.pincode,
      landmark: Joi.string().trim().allow('')
    }),
    contact: Joi.object({
      phone: commonSchemas.phone,
      email: commonSchemas.email
    }),
    capacity: Joi.object({
      maxOrdersPerDay: Joi.number().integer().min(1),
      maxWeightPerDay: Joi.number().min(1)
    }),
    isActive: Joi.boolean()
  })
};

// Ticket validation schemas
const ticketValidation = {
  createTicket: Joi.object({
    title: Joi.string().trim().required(),
    description: Joi.string().trim().required(),
    category: Joi.string().valid(...Object.values(TICKET_CATEGORIES)).required(),
    priority: Joi.string().valid(...Object.values(TICKET_PRIORITY)).default(TICKET_PRIORITY.MEDIUM),
    relatedOrderId: commonSchemas.objectId
  }),

  updateTicket: Joi.object({
    status: Joi.string(),
    priority: Joi.string().valid(...Object.values(TICKET_PRIORITY)),
    assignedTo: commonSchemas.objectId,
    resolution: Joi.string().trim()
  }),

  addMessage: Joi.object({
    message: Joi.string().trim().required(),
    isInternal: Joi.boolean().default(false)
  })
};

// Staff validation schemas
const staffValidation = {
  createStaff: Joi.object({
    name: Joi.string().trim().required(),
    phone: commonSchemas.phone.required(),
    role: Joi.string().valid('washer', 'ironer').required(),
    branchId: commonSchemas.objectId.required()
  }),

  updateStaff: Joi.object({
    name: Joi.string().trim(),
    phone: commonSchemas.phone,
    isActive: Joi.boolean(),
    availability: Joi.object({
      isAvailable: Joi.boolean(),
      maxOrdersPerDay: Joi.number().integer().min(1)
    })
  })
};

// Validation middleware
const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      const message = error.details.map(detail => detail.message).join(', ');
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message
      });
    }
    
    next();
  };
};

module.exports = {
  validate,
  authValidation,
  userValidation,
  orderValidation,
  branchValidation,
  ticketValidation,
  staffValidation,
  commonSchemas
};