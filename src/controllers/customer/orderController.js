const Order = require('../../models/Order');
const OrderItem = require('../../models/OrderItem');
const User = require('../../models/User');
const Branch = require('../../models/Branch');
const { 
  sendSuccess, 
  sendError, 
  asyncHandler, 
  calculateItemPrice, 
  calculateOrderTotal,
  calculateDeliveryDate,
  getPagination,
  formatPaginationResponse
} = require('../../utils/helpers');
const { ORDER_STATUS } = require('../../config/constants');

// @desc    Create new order
// @route   POST /api/customer/orders
// @access  Private (Customer)
const createOrder = asyncHandler(async (req, res) => {
  const {
    items,
    pickupAddressId,
    deliveryAddressId,
    pickupDate,
    pickupTimeSlot,
    paymentMethod,
    isExpress,
    specialInstructions
  } = req.body;

  const customer = await User.findById(req.user._id);
  
  // Get addresses
  const pickupAddress = customer.addresses.id(pickupAddressId);
  const deliveryAddress = customer.addresses.id(deliveryAddressId);
  
  if (!pickupAddress || !deliveryAddress) {
    return sendError(res, 'ADDRESS_NOT_FOUND', 'Pickup or delivery address not found', 404);
  }

  // Find available branch for pickup pincode
  const branch = await Branch.findOne({
    'serviceAreas.pincode': pickupAddress.pincode,
    isActive: true
  });

  if (!branch) {
    return sendError(res, 'SERVICE_UNAVAILABLE', 'Service not available in your area', 400);
  }

  // Calculate pricing for each item
  const orderItems = [];
  let totalAmount = 0;

  for (const item of items) {
    const pricing = calculateItemPrice(item.itemType, item.service, item.category, isExpress);
    const itemTotal = pricing.unitPrice * item.quantity;
    totalAmount += itemTotal;

    orderItems.push({
      itemType: item.itemType,
      service: item.service,
      category: item.category,
      quantity: item.quantity,
      basePrice: pricing.basePrice,
      serviceMultiplier: pricing.serviceMultiplier,
      categoryMultiplier: pricing.categoryMultiplier,
      expressMultiplier: pricing.expressMultiplier,
      unitPrice: pricing.unitPrice,
      totalPrice: itemTotal,
      specialInstructions: item.specialInstructions || ''
    });
  }

  // Calculate order total
  const deliveryCharge = branch.serviceAreas.find(area => area.pincode === pickupAddress.pincode)?.deliveryCharge || 0;
  const pricing = calculateOrderTotal(items, deliveryCharge, 0, 0.18); // 18% tax

  // Create order
  const order = await Order.create({
    customer: req.user._id,
    branch: branch._id,
    pickupAddress: {
      name: pickupAddress.name,
      phone: pickupAddress.phone,
      addressLine1: pickupAddress.addressLine1,
      addressLine2: pickupAddress.addressLine2,
      landmark: pickupAddress.landmark,
      city: pickupAddress.city,
      pincode: pickupAddress.pincode
    },
    deliveryAddress: {
      name: deliveryAddress.name,
      phone: deliveryAddress.phone,
      addressLine1: deliveryAddress.addressLine1,
      addressLine2: deliveryAddress.addressLine2,
      landmark: deliveryAddress.landmark,
      city: deliveryAddress.city,
      pincode: deliveryAddress.pincode
    },
    pickupDate: new Date(pickupDate),
    pickupTimeSlot,
    estimatedDeliveryDate: calculateDeliveryDate(pickupDate, isExpress),
    pricing,
    paymentMethod,
    isExpress,
    isVIPOrder: customer.isVIP,
    specialInstructions,
    statusHistory: [{
      status: ORDER_STATUS.PLACED,
      updatedBy: req.user._id,
      updatedAt: new Date(),
      notes: 'Order placed by customer'
    }]
  });

  // Create order items
  const createdItems = [];
  for (const itemData of orderItems) {
    const orderItem = await OrderItem.create({
      order: order._id,
      ...itemData
    });
    createdItems.push(orderItem);
  }

  // Update order with item references
  order.items = createdItems.map(item => item._id);
  await order.save();

  // Update customer stats
  customer.totalOrders += 1;
  if (customer.isVIP) {
    customer.rewardPoints += Math.floor(pricing.total / 100); // 1 point per ₹100
  }
  await customer.save();

  // Populate order for response
  const populatedOrder = await Order.findById(order._id)
    .populate('items')
    .populate('branch', 'name code');

  sendSuccess(res, { order: populatedOrder }, 'Order created successfully', 201);
});

// @desc    Get customer orders
// @route   GET /api/customer/orders
// @access  Private (Customer)
const getOrders = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const { skip, limit: limitNum, page: pageNum } = getPagination(page, limit);

  const query = { customer: req.user._id };
  if (status) {
    query.status = status;
  }

  const total = await Order.countDocuments(query);
  const orders = await Order.find(query)
    .populate('branch', 'name code')
    .populate('items')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  const response = formatPaginationResponse(orders, total, pageNum, limitNum);
  sendSuccess(res, response, 'Orders retrieved successfully');
});

// @desc    Get order by ID
// @route   GET /api/customer/orders/:orderId
// @access  Private (Customer)
const getOrderById = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const order = await Order.findOne({
    _id: orderId,
    customer: req.user._id
  })
    .populate('branch', 'name code address contact')
    .populate('items')
    .populate('logisticsPartner', 'companyName contactPerson')
    .populate('statusHistory.updatedBy', 'name role');

  if (!order) {
    return sendError(res, 'ORDER_NOT_FOUND', 'Order not found', 404);
  }

  sendSuccess(res, { order }, 'Order retrieved successfully');
});

// @desc    Get order tracking
// @route   GET /api/customer/orders/:orderId/tracking
// @access  Private (Customer)
const getOrderTracking = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const order = await Order.findOne({
    _id: orderId,
    customer: req.user._id
  })
    .select('orderNumber status statusHistory estimatedDeliveryDate actualDeliveryDate')
    .populate('statusHistory.updatedBy', 'name role');

  if (!order) {
    return sendError(res, 'ORDER_NOT_FOUND', 'Order not found', 404);
  }

  sendSuccess(res, { 
    orderNumber: order.orderNumber,
    currentStatus: order.status,
    statusHistory: order.statusHistory,
    estimatedDeliveryDate: order.estimatedDeliveryDate,
    actualDeliveryDate: order.actualDeliveryDate
  }, 'Order tracking retrieved successfully');
});

// @desc    Cancel order
// @route   PUT /api/customer/orders/:orderId/cancel
// @access  Private (Customer)
const cancelOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { reason } = req.body;

  const order = await Order.findOne({
    _id: orderId,
    customer: req.user._id
  });

  if (!order) {
    return sendError(res, 'ORDER_NOT_FOUND', 'Order not found', 404);
  }

  if (!order.canBeCancelled()) {
    return sendError(res, 'CANNOT_CANCEL', 'Order cannot be cancelled at this stage', 400);
  }

  // Update order status
  await order.updateStatus(ORDER_STATUS.CANCELLED, req.user._id, reason || 'Cancelled by customer');
  
  order.isCancelled = true;
  order.cancellationReason = reason || 'Cancelled by customer';
  order.cancelledBy = req.user._id;
  order.cancelledAt = new Date();
  
  await order.save();

  sendSuccess(res, { order }, 'Order cancelled successfully');
});

// @desc    Rate order
// @route   PUT /api/customer/orders/:orderId/rate
// @access  Private (Customer)
const rateOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { score, feedback } = req.body;

  const order = await Order.findOne({
    _id: orderId,
    customer: req.user._id,
    status: ORDER_STATUS.DELIVERED
  });

  if (!order) {
    return sendError(res, 'ORDER_NOT_FOUND', 'Order not found or not delivered yet', 404);
  }

  if (order.rating.score) {
    return sendError(res, 'ALREADY_RATED', 'Order has already been rated', 400);
  }

  order.rating = {
    score,
    feedback: feedback || '',
    ratedAt: new Date()
  };

  await order.save();

  sendSuccess(res, { rating: order.rating }, 'Order rated successfully');
});

// @desc    Reorder (duplicate previous order)
// @route   POST /api/customer/orders/:orderId/reorder
// @access  Private (Customer)
const reorder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const originalOrder = await Order.findOne({
    _id: orderId,
    customer: req.user._id
  }).populate('items');

  if (!originalOrder) {
    return sendError(res, 'ORDER_NOT_FOUND', 'Original order not found', 404);
  }

  // Create reorder data
  const reorderData = {
    items: originalOrder.items.map(item => ({
      itemType: item.itemType,
      service: item.service,
      category: item.category,
      quantity: item.quantity,
      specialInstructions: item.specialInstructions
    })),
    pickupAddressId: null, // Will need to be provided by frontend
    deliveryAddressId: null, // Will need to be provided by frontend
    pickupDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    pickupTimeSlot: '09:00-11:00', // Default slot
    paymentMethod: originalOrder.paymentMethod,
    isExpress: originalOrder.isExpress,
    specialInstructions: originalOrder.specialInstructions
  };

  sendSuccess(res, { reorderData }, 'Reorder data prepared successfully');
});

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  getOrderTracking,
  cancelOrder,
  rateOrder,
  reorder
};