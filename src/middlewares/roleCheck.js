const { USER_ROLES } = require('../config/constants');

// Check if user has required role
const roleCheck = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

// Specific role checkers
const isCustomer = roleCheck(USER_ROLES.CUSTOMER);
const isAdmin = roleCheck(USER_ROLES.ADMIN);
const isBranchManager = roleCheck(USER_ROLES.BRANCH_MANAGER);
const isSupportAgent = roleCheck(USER_ROLES.SUPPORT_AGENT);
const isCenterAdmin = roleCheck(USER_ROLES.CENTER_ADMIN);

// Combined role checkers
const isAdminOrCenterAdmin = roleCheck(USER_ROLES.ADMIN, USER_ROLES.CENTER_ADMIN);
const isBranchManagerOrAdmin = roleCheck(USER_ROLES.BRANCH_MANAGER, USER_ROLES.ADMIN, USER_ROLES.CENTER_ADMIN);
const isSupportOrAdmin = roleCheck(USER_ROLES.SUPPORT_AGENT, USER_ROLES.ADMIN, USER_ROLES.CENTER_ADMIN);

// Check if user can access specific branch
const canAccessBranch = (req, res, next) => {
  const { branchId } = req.params;
  const user = req.user;

  // Center Admin can access all branches
  if (user.role === USER_ROLES.CENTER_ADMIN) {
    return next();
  }

  // Admin can access all branches
  if (user.role === USER_ROLES.ADMIN) {
    return next();
  }

  // Branch Manager can only access their assigned branch
  if (user.role === USER_ROLES.BRANCH_MANAGER) {
    if (user.assignedBranch && user.assignedBranch.toString() === branchId) {
      return next();
    } else {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Access denied to this branch'
      });
    }
  }

  // Other roles cannot access branch-specific data
  return res.status(403).json({
    success: false,
    error: 'FORBIDDEN',
    message: 'Insufficient permissions'
  });
};

// Check if user can access specific order
const canAccessOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const user = req.user;
    const Order = require('../models/Order');

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'ORDER_NOT_FOUND',
        message: 'Order not found'
      });
    }

    // Customer can only access their own orders
    if (user.role === USER_ROLES.CUSTOMER) {
      if (order.customer.toString() !== user._id.toString()) {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: 'Access denied to this order'
        });
      }
    }

    // Branch Manager can only access orders assigned to their branch
    if (user.role === USER_ROLES.BRANCH_MANAGER) {
      if (!order.branch || order.branch.toString() !== user.assignedBranch.toString()) {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: 'Access denied to this order'
        });
      }
    }

    // Admin and Center Admin can access all orders
    // Support Agent can access all orders for support purposes

    req.order = order;
    next();
  } catch (error) {
    console.error('Order access check error:', error);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Error checking order access'
    });
  }
};

module.exports = {
  roleCheck,
  isCustomer,
  isAdmin,
  isBranchManager,
  isSupportAgent,
  isCenterAdmin,
  isAdminOrCenterAdmin,
  isBranchManagerOrAdmin,
  isSupportOrAdmin,
  canAccessBranch,
  canAccessOrder
};