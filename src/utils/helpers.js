const jwt = require('jsonwebtoken');
const { SERVICES, CLOTHING_CATEGORIES, ITEM_TYPES } = require('../config/constants');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '24h'
  });
};

// Standard API response format
const sendResponse = (res, statusCode, success, data = null, message = '', error = null) => {
  const response = {
    success,
    ...(data && { data }),
    ...(message && { message }),
    ...(error && { error })
  };
  
  return res.status(statusCode).json(response);
};

// Success response helper
const sendSuccess = (res, data = null, message = 'Success', statusCode = 200) => {
  return sendResponse(res, statusCode, true, data, message);
};

// Error response helper
const sendError = (res, error = 'SERVER_ERROR', message = 'Something went wrong', statusCode = 500) => {
  return sendResponse(res, statusCode, false, null, message, error);
};

// Pagination helper
const getPagination = (page = 1, limit = 10) => {
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;
  
  return {
    skip,
    limit: limitNum,
    page: pageNum
  };
};

// Format pagination response
const formatPaginationResponse = (data, total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  
  return {
    data,
    pagination: {
      currentPage: page,
      totalPages,
      totalItems: total,
      itemsPerPage: limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    }
  };
};

// Pricing calculation helper
const calculateItemPrice = (itemType, service, category, isExpress = false) => {
  // Base prices (in rupees) - these would come from database in real implementation
  const basePrices = {
    // Men's items
    [ITEM_TYPES.MENS_SHIRT]: 30,
    [ITEM_TYPES.MENS_PANT]: 40,
    [ITEM_TYPES.MENS_TSHIRT]: 25,
    [ITEM_TYPES.MENS_JEANS]: 50,
    [ITEM_TYPES.MENS_SUIT]: 200,
    
    // Women's items
    [ITEM_TYPES.WOMENS_DRESS]: 60,
    [ITEM_TYPES.WOMENS_BLOUSE]: 35,
    [ITEM_TYPES.WOMENS_SAREE]: 80,
    [ITEM_TYPES.WOMENS_KURTI]: 40,
    [ITEM_TYPES.WOMENS_JEANS]: 50,
    
    // Kids items
    [ITEM_TYPES.KIDS_SHIRT]: 20,
    [ITEM_TYPES.KIDS_DRESS]: 25,
    [ITEM_TYPES.KIDS_PANT]: 25,
    
    // Household items
    [ITEM_TYPES.BEDSHEET]: 60,
    [ITEM_TYPES.CURTAIN]: 100,
    [ITEM_TYPES.TOWEL]: 20,
    [ITEM_TYPES.PILLOW_COVER]: 15
  };

  // Service multipliers
  const serviceMultipliers = {
    [SERVICES.WASHING]: 1,
    [SERVICES.DRY_CLEANING]: 2,
    [SERVICES.IRONING]: 0.5
  };

  // Category multipliers
  const categoryMultipliers = {
    [CLOTHING_CATEGORIES.NORMAL]: 1,
    [CLOTHING_CATEGORIES.DELICATE]: 1.5,
    [CLOTHING_CATEGORIES.WOOLEN]: 2
  };

  const basePrice = basePrices[itemType] || 30;
  const serviceMultiplier = serviceMultipliers[service] || 1;
  const categoryMultiplier = categoryMultipliers[category] || 1;
  const expressMultiplier = isExpress ? 1.5 : 1;

  const unitPrice = basePrice * serviceMultiplier * categoryMultiplier * expressMultiplier;

  return {
    basePrice,
    serviceMultiplier,
    categoryMultiplier,
    expressMultiplier,
    unitPrice: Math.round(unitPrice)
  };
};

// Calculate order total
const calculateOrderTotal = (items, deliveryCharge = 0, discount = 0, taxRate = 0.18) => {
  let subtotal = 0;
  let expressCharge = 0;

  items.forEach(item => {
    const pricing = calculateItemPrice(item.itemType, item.service, item.category, item.isExpress);
    const itemTotal = pricing.unitPrice * item.quantity;
    subtotal += itemTotal;
    
    if (item.isExpress) {
      expressCharge += (pricing.unitPrice * 0.5) * item.quantity; // 50% express charge
    }
  });

  const discountAmount = (subtotal * discount) / 100;
  const taxableAmount = subtotal + deliveryCharge + expressCharge - discountAmount;
  const tax = taxableAmount * taxRate;
  const total = taxableAmount + tax;

  return {
    subtotal: Math.round(subtotal),
    expressCharge: Math.round(expressCharge),
    deliveryCharge: Math.round(deliveryCharge),
    discount: Math.round(discountAmount),
    tax: Math.round(tax),
    total: Math.round(total)
  };
};

// Generate order number
const generateOrderNumber = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ORD${timestamp}${random}`;
};

// Generate ticket number
const generateTicketNumber = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `TKT${timestamp}${random}`;
};

// Format date for display
const formatDate = (date, format = 'DD/MM/YYYY') => {
  const moment = require('moment');
  return moment(date).format(format);
};

// Check if date is today
const isToday = (date) => {
  const today = new Date();
  const checkDate = new Date(date);
  return checkDate.toDateString() === today.toDateString();
};

// Get time slots for pickup/delivery
const getTimeSlots = () => {
  return [
    '09:00-11:00',
    '11:00-13:00',
    '13:00-15:00',
    '15:00-17:00',
    '17:00-19:00'
  ];
};

// Validate time slot
const isValidTimeSlot = (timeSlot) => {
  const validSlots = getTimeSlots();
  return validSlots.includes(timeSlot);
};

// Calculate estimated delivery date
const calculateDeliveryDate = (pickupDate, isExpress = false) => {
  const pickup = new Date(pickupDate);
  const deliveryDays = isExpress ? 1 : 2; // Express: 1 day, Normal: 2 days
  
  const deliveryDate = new Date(pickup);
  deliveryDate.setDate(pickup.getDate() + deliveryDays);
  
  return deliveryDate;
};

// Generate random OTP
const generateOTP = (length = 6) => {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
};

// Mask sensitive data
const maskPhone = (phone) => {
  if (!phone || phone.length < 4) return phone;
  return phone.slice(0, 2) + '*'.repeat(phone.length - 4) + phone.slice(-2);
};

const maskEmail = (email) => {
  if (!email || !email.includes('@')) return email;
  const [username, domain] = email.split('@');
  const maskedUsername = username.slice(0, 2) + '*'.repeat(Math.max(0, username.length - 2));
  return `${maskedUsername}@${domain}`;
};

// Async error handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  generateToken,
  sendResponse,
  sendSuccess,
  sendError,
  getPagination,
  formatPaginationResponse,
  calculateItemPrice,
  calculateOrderTotal,
  generateOrderNumber,
  generateTicketNumber,
  formatDate,
  isToday,
  getTimeSlots,
  isValidTimeSlot,
  calculateDeliveryDate,
  generateOTP,
  maskPhone,
  maskEmail,
  asyncHandler
};