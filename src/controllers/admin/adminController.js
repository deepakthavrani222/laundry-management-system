const Order = require('../../models/Order');
const User = require('../../models/User');
const Branch = require('../../models/Branch');
const LogisticsPartner = require('../../models/LogisticsPartner');
const Ticket = require('../../models/Ticket');
const { 
  sendSuccess, 
  sendError, 
  asyncHandler,
  getPagination,
  formatPaginationResponse
} = require('../../utils/helpers');
const { ORDER_STATUS, USER_ROLES, TICKET_STATUS } = require('../../config/constants');

// @desc    Get admin dashboard data
// @route   GET /api/admin/dashboard
// @access  Private (Admin/Center Admin)
const getDashboard = asyncHandler(async (req, res) => {
  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));

  // Get dashboard metrics
  const [
    totalOrders,
    todayOrders,
    pendingOrders,
    expressOrders,
    totalCustomers,
    activeCustomers,
    pendingComplaints,
    totalBranches
  ] = await Promise.all([
    Order.countDocuments(),
    Order.countDocuments({ createdAt: { $gte: startOfDay, $lte: endOfDay } }),
    Order.countDocuments({ 
      status: { $in: [ORDER_STATUS.PLACED, ORDER_STATUS.ASSIGNED_TO_BRANCH] }
    }),
    Order.countDocuments({ isExpress: true, status: { $ne: ORDER_STATUS.DELIVERED } }),
    User.countDocuments({ role: USER_ROLES.CUSTOMER }),
    User.countDocuments({ role: USER_ROLES.CUSTOMER, isActive: true }),
    Ticket.countDocuments({ status: { $in: [TICKET_STATUS.OPEN, TICKET_STATUS.IN_PROGRESS] } }),
    Branch.countDocuments({ isActive: true })
  ]);

  // Get recent orders
  const recentOrders = await Order.find()
    .populate('customer', 'name phone')
    .populate('branch', 'name code')
    .sort({ createdAt: -1 })
    .limit(10)
    .select('orderNumber status pricing.total createdAt isExpress');

  // Get order status distribution
  const statusDistribution = await Order.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const dashboardData = {
    metrics: {
      totalOrders,
      todayOrders,
      pendingOrders,
      expressOrders,
      totalCustomers,
      activeCustomers,
      pendingComplaints,
      totalBranches
    },
    recentOrders,
    statusDistribution
  };

  sendSuccess(res, dashboardData, 'Dashboard data retrieved successfully');
});

// @desc    Get all orders for admin
// @route   GET /api/admin/orders
// @access  Private (Admin/Center Admin)
const getAllOrders = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 20, 
    status, 
    branch, 
    isExpress, 
    search,
    startDate,
    endDate
  } = req.query;

  const { skip, limit: limitNum, page: pageNum } = getPagination(page, limit);

  // Build query
  const query = {};
  
  if (status) query.status = status;
  if (branch) query.branch = branch;
  if (isExpress !== undefined) query.isExpress = isExpress === 'true';
  
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  if (search) {
    query.$or = [
      { orderNumber: { $regex: search, $options: 'i' } },
      { 'pickupAddress.phone': { $regex: search, $options: 'i' } }
    ];
  }

  const total = await Order.countDocuments(query);
  const orders = await Order.find(query)
    .populate('customer', 'name phone email isVIP')
    .populate('branch', 'name code')
    .populate('logisticsPartner', 'companyName')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  const response = formatPaginationResponse(orders, total, pageNum, limitNum);
  sendSuccess(res, response, 'Orders retrieved successfully');
});

// @desc    Assign order to branch
// @route   PUT /api/admin/orders/:orderId/assign-branch
// @access  Private (Admin/Center Admin)
const assignOrderToBranch = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { branchId } = req.body;

  if (!branchId) {
    return sendError(res, 'BRANCH_REQUIRED', 'Branch ID is required', 400);
  }

  const order = await Order.findById(orderId);
  if (!order) {
    return sendError(res, 'ORDER_NOT_FOUND', 'Order not found', 404);
  }

  if (order.status !== ORDER_STATUS.PLACED) {
    return sendError(res, 'INVALID_STATUS', 'Order cannot be assigned at this stage', 400);
  }

  const branch = await Branch.findById(branchId);
  if (!branch || !branch.isActive) {
    return sendError(res, 'BRANCH_NOT_FOUND', 'Branch not found or inactive', 404);
  }

  // Check branch capacity
  if (!branch.hasCapacity()) {
    return sendError(res, 'BRANCH_FULL', 'Branch has reached capacity', 400);
  }

  // Update order
  order.branch = branchId;
  await order.updateStatus(ORDER_STATUS.ASSIGNED_TO_BRANCH, req.user._id, `Assigned to branch: ${branch.name}`);

  const updatedOrder = await Order.findById(orderId)
    .populate('branch', 'name code')
    .populate('customer', 'name phone');

  sendSuccess(res, { order: updatedOrder }, 'Order assigned to branch successfully');
});

// @desc    Assign order to logistics partner
// @route   PUT /api/admin/orders/:orderId/assign-logistics
// @access  Private (Admin/Center Admin)
const assignOrderToLogistics = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { logisticsPartnerId, type } = req.body; // type: 'pickup' or 'delivery'

  if (!logisticsPartnerId || !type) {
    return sendError(res, 'MISSING_DATA', 'Logistics partner ID and type are required', 400);
  }

  const order = await Order.findById(orderId);
  if (!order) {
    return sendError(res, 'ORDER_NOT_FOUND', 'Order not found', 404);
  }

  const logisticsPartner = await LogisticsPartner.findById(logisticsPartnerId);
  if (!logisticsPartner || !logisticsPartner.isActive) {
    return sendError(res, 'LOGISTICS_NOT_FOUND', 'Logistics partner not found or inactive', 404);
  }

  // Check if logistics partner covers the area
  const pincode = type === 'pickup' ? order.pickupAddress.pincode : order.deliveryAddress.pincode;
  if (!logisticsPartner.coversPincode(pincode)) {
    return sendError(res, 'AREA_NOT_COVERED', 'Logistics partner does not cover this area', 400);
  }

  let newStatus;
  let notes;

  if (type === 'pickup') {
    if (order.status !== ORDER_STATUS.ASSIGNED_TO_BRANCH) {
      return sendError(res, 'INVALID_STATUS', 'Order must be assigned to branch first', 400);
    }
    newStatus = ORDER_STATUS.ASSIGNED_TO_LOGISTICS_PICKUP;
    notes = `Assigned to ${logisticsPartner.companyName} for pickup`;
  } else {
    if (order.status !== ORDER_STATUS.READY) {
      return sendError(res, 'INVALID_STATUS', 'Order must be ready for delivery assignment', 400);
    }
    newStatus = ORDER_STATUS.ASSIGNED_TO_LOGISTICS_DELIVERY;
    notes = `Assigned to ${logisticsPartner.companyName} for delivery`;
  }

  // Update order
  order.logisticsPartner = logisticsPartnerId;
  await order.updateStatus(newStatus, req.user._id, notes);

  const updatedOrder = await Order.findById(orderId)
    .populate('logisticsPartner', 'companyName contactPerson')
    .populate('branch', 'name code');

  sendSuccess(res, { order: updatedOrder }, `Order assigned for ${type} successfully`);
});

// @desc    Update order status
// @route   PUT /api/admin/orders/:orderId/status
// @access  Private (Admin/Center Admin)
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { status, notes } = req.body;

  const order = await Order.findById(orderId);
  if (!order) {
    return sendError(res, 'ORDER_NOT_FOUND', 'Order not found', 404);
  }

  // Validate status transition
  const validStatuses = Object.values(ORDER_STATUS);
  if (!validStatuses.includes(status)) {
    return sendError(res, 'INVALID_STATUS', 'Invalid order status', 400);
  }

  await order.updateStatus(status, req.user._id, notes || `Status updated by admin`);

  const updatedOrder = await Order.findById(orderId)
    .populate('customer', 'name phone')
    .populate('branch', 'name code');

  sendSuccess(res, { order: updatedOrder }, 'Order status updated successfully');
});

// @desc    Get all customers
// @route   GET /api/admin/customers
// @access  Private (Admin/Center Admin)
const getCustomers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, isVIP, isActive } = req.query;
  const { skip, limit: limitNum, page: pageNum } = getPagination(page, limit);

  const query = { role: USER_ROLES.CUSTOMER };
  
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } }
    ];
  }
  
  if (isVIP !== undefined) query.isVIP = isVIP === 'true';
  if (isActive !== undefined) query.isActive = isActive === 'true';

  const total = await User.countDocuments(query);
  const customers = await User.find(query)
    .select('-password')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  // Get order counts for each customer
  const customersWithStats = await Promise.all(
    customers.map(async (customer) => {
      const orderCount = await Order.countDocuments({ customer: customer._id });
      const totalSpent = await Order.aggregate([
        { $match: { customer: customer._id, status: ORDER_STATUS.DELIVERED } },
        { $group: { _id: null, total: { $sum: '$pricing.total' } } }
      ]);
      
      return {
        ...customer.toObject(),
        stats: {
          totalOrders: orderCount,
          totalSpent: totalSpent[0]?.total || 0
        }
      };
    })
  );

  const response = formatPaginationResponse(customersWithStats, total, pageNum, limitNum);
  sendSuccess(res, response, 'Customers retrieved successfully');
});

// @desc    Toggle customer active status
// @route   PUT /api/admin/customers/:customerId/toggle-status
// @access  Private (Admin/Center Admin)
const toggleCustomerStatus = asyncHandler(async (req, res) => {
  const { customerId } = req.params;

  const customer = await User.findOne({ 
    _id: customerId, 
    role: USER_ROLES.CUSTOMER 
  });

  if (!customer) {
    return sendError(res, 'CUSTOMER_NOT_FOUND', 'Customer not found', 404);
  }

  customer.isActive = !customer.isActive;
  await customer.save();

  sendSuccess(res, { 
    customer: { 
      _id: customer._id, 
      name: customer.name, 
      isActive: customer.isActive 
    } 
  }, `Customer ${customer.isActive ? 'activated' : 'deactivated'} successfully`);
});

// @desc    Tag customer as VIP
// @route   PUT /api/admin/customers/:customerId/vip
// @access  Private (Admin/Center Admin)
const tagVIPCustomer = asyncHandler(async (req, res) => {
  const { customerId } = req.params;
  const { isVIP } = req.body;

  const customer = await User.findOne({ 
    _id: customerId, 
    role: USER_ROLES.CUSTOMER 
  });

  if (!customer) {
    return sendError(res, 'CUSTOMER_NOT_FOUND', 'Customer not found', 404);
  }

  customer.isVIP = isVIP;
  await customer.save();

  sendSuccess(res, { 
    customer: { 
      _id: customer._id, 
      name: customer.name, 
      isVIP: customer.isVIP 
    } 
  }, `Customer VIP status updated successfully`);
});

// @desc    Get refund requests
// @route   GET /api/admin/refunds
// @access  Private (Admin/Center Admin)
const getRefundRequests = asyncHandler(async (req, res) => {
  // This would be implemented when we add refund model
  // For now, return placeholder
  sendSuccess(res, { refunds: [] }, 'Refund requests retrieved successfully');
});

// @desc    Process refund
// @route   PUT /api/admin/refunds/:refundId/process
// @access  Private (Admin/Center Admin)
const processRefund = asyncHandler(async (req, res) => {
  // This would be implemented when we add refund model
  // For now, return placeholder
  sendSuccess(res, null, 'Refund processed successfully');
});

module.exports = {
  getDashboard,
  getAllOrders,
  assignOrderToBranch,
  assignOrderToLogistics,
  updateOrderStatus,
  getCustomers,
  toggleCustomerStatus,
  tagVIPCustomer,
  getRefundRequests,
  processRefund
};