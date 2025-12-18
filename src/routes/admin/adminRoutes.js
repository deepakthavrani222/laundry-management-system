const express = require('express');
const auth = require('../../middlewares/auth');
const { isAdminOrCenterAdmin } = require('../../middlewares/roleCheck');

// Import admin controllers
const {
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
} = require('../../controllers/admin/adminController');

const { validate, orderValidation } = require('../../utils/validators');

const router = express.Router();

// Apply authentication and admin role check
router.use(auth);
router.use(isAdminOrCenterAdmin);

// Dashboard
router.get('/dashboard', getDashboard);

// Order Management
router.get('/orders', getAllOrders);
router.put('/orders/:orderId/assign-branch', assignOrderToBranch);
router.put('/orders/:orderId/assign-logistics', assignOrderToLogistics);
router.put('/orders/:orderId/status', validate(orderValidation.updateOrderStatus), updateOrderStatus);

// Customer Management
router.get('/customers', getCustomers);
router.put('/customers/:customerId/toggle-status', toggleCustomerStatus);
router.put('/customers/:customerId/vip', tagVIPCustomer);

// Refund Management
router.get('/refunds', getRefundRequests);
router.put('/refunds/:refundId/process', processRefund);

module.exports = router;