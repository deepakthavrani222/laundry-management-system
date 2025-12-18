const Order = require('../../models/Order');
const OrderItem = require('../../models/OrderItem');
const Staff = require('../../models/Staff');
const Branch = require('../../models/Branch');
const User = require('../../models/User');
const { 
  sendSuccess, 
  sendError, 
  asyncHandler,
  getPagination,
  formatPaginationResponse
} = require('../../utils/helpers');
const { ORDER_STATUS, USER_ROLES, STAFF_ROLES } = require('../../config/constants');

// @desc    Get branch dashboard data
// @route   GET /api/branch/dashboard
// @access  Private (Branch Manager/Admin)
const getBranchDashboard = asyncHandler(async (req, res) => {
  const user = req.user;
  let branchId;

  // Get branch ID based on user role
  if (user.role === USER_ROLES.BRANCH_MANAGER) {
    branchId = user.assignedBranch;
    if (!branchId) {
      return sendError(res, 'NO_BRANCH_ASSIGNED', 'No branch assigned to this manager', 400);
    }
  } else {
    // For admin, they need to specify branch or we show all
    branchId = req.query.branchId;
    if (!branchId) {
      return sendError(res, 'BRANCH_REQUIRED', 'Branch ID is required', 400);
    }
  }

  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));

  // Get branch dashboard metrics
  const [
    totalOrders,
    todayOrders,
    pendingOrders,
    inProcessOrders,
    readyOrders,
    totalStaff,
    activeStaff,
    branch
  ] = await Promise.all([
    Order.countDocuments({ branch: branchId }),
    Order.countDocuments({ 
      branch: branchId, 
      createdAt: { $gte: startOfDay, $lte: endOfDay } 
    }),
    Order.countDocuments({ 
      branch: branchId, 
      status: { $in: [ORDER_STATUS.ASSIGNED_TO_BRANCH, ORDER_STATUS.PICKED] }
    }),
    Order.countDocuments({ 
      branch: branchId, 
      status: ORDER_STATUS.IN_PROCESS 
    }),
    Order.countDocuments({ 
      branch: branchId, 
      status: ORDER_STATUS.READY 
    }),
    Staff.countDocuments({ branch: branchId }),
    Staff.countDocuments({ branch: branchId, isActive: true }),
    Branch.findById(branchId)
  ]);

  // Get recent orders for this branch
  const recentOrders = await Order.find({ branch: branchId })
    .populate('customer', 'name phone')
    .sort({ createdAt: -1 })
    .limit(10)
    .select('orderNumber status pricing.total createdAt isExpress');

  // Get staff performance
  const staffPerformance = await Staff.find({ branch: branchId, isActive: true })
    .select('name role performance currentOrders')
    .limit(5);

  const dashboardData = {
    branch: {
      name: branch?.name,
      code: branch?.code
    },
    metrics: {
      totalOrders,
      todayOrders,
      pendingOrders,
      inProcessOrders,
      readyOrders,
      totalStaff,
      activeStaff
    },
    recentOrders,
    staffPerformance
  };

  sendSuccess(res, dashboardData, 'Branch dashboard data retrieved successfully');
});

// @desc    Get branch orders
// @route   GET /api/branch/orders
// @access  Private (Branch Manager/Admin)
const getBranchOrders = asyncHandler(async (req, res) => {
  const user = req.user;
  let branchId;

  // Get branch ID based on user role
  if (user.role === USER_ROLES.BRANCH_MANAGER) {
    branchId = user.assignedBranch;
  } else {
    branchId = req.query.branchId;
  }

  if (!branchId) {
    return sendError(res, 'BRANCH_REQUIRED', 'Branch ID is required', 400);
  }

  const { 
    page = 1, 
    limit = 20, 
    status, 
    search,
    startDate,
    endDate
  } = req.query;

  const { skip, limit: limitNum, page: pageNum } = getPagination(page, limit);

  // Build query
  const query = { branch: branchId };
  
  if (status) query.status = status;
  
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
    .populate('items')
    .populate('assignedStaff.staff', 'name role')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  const response = formatPaginationResponse(orders, total, pageNum, limitNum);
  sendSuccess(res, response, 'Branch orders retrieved successfully');
});

// @desc    Update order status (Branch Manager)
// @route   PUT /api/branch/orders/:orderId/status
// @access  Private (Branch Manager/Admin)
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { status, notes } = req.body;
  const user = req.user;

  const order = await Order.findById(orderId);
  if (!order) {
    return sendError(res, 'ORDER_NOT_FOUND', 'Order not found', 404);
  }

  // Check if branch manager can access this order
  if (user.role === USER_ROLES.BRANCH_MANAGER) {
    if (!order.branch || order.branch.toString() !== user.assignedBranch.toString()) {
      return sendError(res, 'FORBIDDEN', 'Access denied to this order', 403);
    }
  }

  // Validate status transitions that branch manager can make
  const allowedTransitions = {
    [ORDER_STATUS.ASSIGNED_TO_LOGISTICS_PICKUP]: [ORDER_STATUS.PICKED],
    [ORDER_STATUS.PICKED]: [ORDER_STATUS.IN_PROCESS],
    [ORDER_STATUS.IN_PROCESS]: [ORDER_STATUS.READY],
    [ORDER_STATUS.READY]: [ORDER_STATUS.ASSIGNED_TO_LOGISTICS_DELIVERY],
    [ORDER_STATUS.ASSIGNED_TO_LOGISTICS_DELIVERY]: [ORDER_STATUS.OUT_FOR_DELIVERY],
    [ORDER_STATUS.OUT_FOR_DELIVERY]: [ORDER_STATUS.DELIVERED]
  };

  if (!allowedTransitions[order.status]?.includes(status)) {
    return sendError(res, 'INVALID_TRANSITION', 'Invalid status transition', 400);
  }

  await order.updateStatus(status, user._id, notes || `Status updated by branch manager`);

  // If moving to IN_PROCESS, deduct inventory
  if (status === ORDER_STATUS.IN_PROCESS) {
    // TODO: Implement inventory deduction logic
  }

  const updatedOrder = await Order.findById(orderId)
    .populate('customer', 'name phone')
    .populate('items');

  sendSuccess(res, { order: updatedOrder }, 'Order status updated successfully');
});

// @desc    Assign staff to order
// @route   PUT /api/branch/orders/:orderId/assign-staff
// @access  Private (Branch Manager/Admin)
const assignStaffToOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { staffId } = req.body;
  const user = req.user;

  if (!staffId) {
    return sendError(res, 'STAFF_REQUIRED', 'Staff ID is required', 400);
  }

  const order = await Order.findById(orderId);
  if (!order) {
    return sendError(res, 'ORDER_NOT_FOUND', 'Order not found', 404);
  }

  // Check branch access
  if (user.role === USER_ROLES.BRANCH_MANAGER) {
    if (!order.branch || order.branch.toString() !== user.assignedBranch.toString()) {
      return sendError(res, 'FORBIDDEN', 'Access denied to this order', 403);
    }
  }

  const staff = await Staff.findById(staffId);
  if (!staff || !staff.isActive) {
    return sendError(res, 'STAFF_NOT_FOUND', 'Staff not found or inactive', 404);
  }

  // Check if staff belongs to the same branch
  if (staff.branch.toString() !== order.branch.toString()) {
    return sendError(res, 'STAFF_BRANCH_MISMATCH', 'Staff does not belong to this branch', 400);
  }

  // Check if staff is available
  if (!staff.isAvailableForWork()) {
    return sendError(res, 'STAFF_UNAVAILABLE', 'Staff is not available for new orders', 400);
  }

  // Assign staff to order
  const existingAssignment = order.assignedStaff.find(
    assignment => assignment.staff.toString() === staffId
  );

  if (existingAssignment) {
    return sendError(res, 'ALREADY_ASSIGNED', 'Staff is already assigned to this order', 400);
  }

  order.assignedStaff.push({
    staff: staffId,
    assignedAt: new Date()
  });

  await order.save();

  // Update staff workload
  await staff.assignOrder(orderId);

  const updatedOrder = await Order.findById(orderId)
    .populate('assignedStaff.staff', 'name role');

  sendSuccess(res, { order: updatedOrder }, 'Staff assigned to order successfully');
});

// @desc    Get branch staff
// @route   GET /api/branch/staff
// @access  Private (Branch Manager/Admin)
const getStaff = asyncHandler(async (req, res) => {
  const user = req.user;
  let branchId;

  if (user.role === USER_ROLES.BRANCH_MANAGER) {
    branchId = user.assignedBranch;
  } else {
    branchId = req.query.branchId;
  }

  if (!branchId) {
    return sendError(res, 'BRANCH_REQUIRED', 'Branch ID is required', 400);
  }

  const { page = 1, limit = 20, role, isActive } = req.query;
  const { skip, limit: limitNum, page: pageNum } = getPagination(page, limit);

  const query = { branch: branchId };
  if (role) query.role = role;
  if (isActive !== undefined) query.isActive = isActive === 'true';

  const total = await Staff.countDocuments(query);
  const staff = await Staff.find(query)
    .populate('currentOrders.order', 'orderNumber status')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  const response = formatPaginationResponse(staff, total, pageNum, limitNum);
  sendSuccess(res, response, 'Staff retrieved successfully');
});

// @desc    Create new staff
// @route   POST /api/branch/staff
// @access  Private (Branch Manager/Admin)
const createStaff = asyncHandler(async (req, res) => {
  const { name, phone, role } = req.body;
  const user = req.user;

  let branchId;
  if (user.role === USER_ROLES.BRANCH_MANAGER) {
    branchId = user.assignedBranch;
  } else {
    branchId = req.body.branchId;
  }

  if (!branchId) {
    return sendError(res, 'BRANCH_REQUIRED', 'Branch ID is required', 400);
  }

  // Check if phone number already exists
  const existingStaff = await Staff.findOne({ phone });
  if (existingStaff) {
    return sendError(res, 'PHONE_EXISTS', 'Staff with this phone number already exists', 400);
  }

  const staff = await Staff.create({
    name,
    phone,
    role,
    branch: branchId
  });

  sendSuccess(res, { staff }, 'Staff created successfully', 201);
});

// @desc    Update staff
// @route   PUT /api/branch/staff/:staffId
// @access  Private (Branch Manager/Admin)
const updateStaff = asyncHandler(async (req, res) => {
  const { staffId } = req.params;
  const updateData = req.body;
  const user = req.user;

  const staff = await Staff.findById(staffId);
  if (!staff) {
    return sendError(res, 'STAFF_NOT_FOUND', 'Staff not found', 404);
  }

  // Check branch access
  if (user.role === USER_ROLES.BRANCH_MANAGER) {
    if (staff.branch.toString() !== user.assignedBranch.toString()) {
      return sendError(res, 'FORBIDDEN', 'Access denied to this staff member', 403);
    }
  }

  // Update staff
  Object.keys(updateData).forEach(key => {
    if (updateData[key] !== undefined) {
      if (key === 'availability') {
        staff.availability = { ...staff.availability, ...updateData[key] };
      } else {
        staff[key] = updateData[key];
      }
    }
  });

  await staff.save();

  sendSuccess(res, { staff }, 'Staff updated successfully');
});

// @desc    Get branch inventory
// @route   GET /api/branch/inventory
// @access  Private (Branch Manager/Admin)
const getInventory = asyncHandler(async (req, res) => {
  // This would be implemented when we create inventory model
  // For now, return mock data
  const mockInventory = [
    {
      _id: '1',
      itemName: 'Detergent',
      currentStock: 50,
      minThreshold: 20,
      unit: 'liters',
      lastRestocked: new Date(),
      isLowStock: false
    },
    {
      _id: '2',
      itemName: 'Fabric Softener',
      currentStock: 15,
      minThreshold: 20,
      unit: 'liters',
      lastRestocked: new Date(),
      isLowStock: true
    }
  ];

  sendSuccess(res, { inventory: mockInventory }, 'Inventory retrieved successfully');
});

// @desc    Update inventory item
// @route   PUT /api/branch/inventory/:itemId
// @access  Private (Branch Manager/Admin)
const updateInventory = asyncHandler(async (req, res) => {
  // This would be implemented when we create inventory model
  sendSuccess(res, null, 'Inventory updated successfully');
});

// @desc    Request inventory restock
// @route   POST /api/branch/inventory/restock-request
// @access  Private (Branch Manager/Admin)
const requestRestock = asyncHandler(async (req, res) => {
  // This would be implemented when we create inventory and restock request models
  sendSuccess(res, null, 'Restock request submitted successfully');
});

module.exports = {
  getBranchDashboard,
  getBranchOrders,
  updateOrderStatus,
  assignStaffToOrder,
  getStaff,
  createStaff,
  updateStaff,
  getInventory,
  updateInventory,
  requestRestock
};