const express = require('express');
const auth = require('../../middlewares/auth');
const { isBranchManagerOrAdmin } = require('../../middlewares/roleCheck');

// Import branch controllers
const {
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
} = require('../../controllers/branch/branchController');

const { validate, orderValidation, staffValidation } = require('../../utils/validators');

const router = express.Router();

// Apply authentication and branch manager role check
router.use(auth);
router.use(isBranchManagerOrAdmin);

// Dashboard
router.get('/dashboard', getBranchDashboard);

// Order Management
router.get('/orders', getBranchOrders);
router.put('/orders/:orderId/status', validate(orderValidation.updateOrderStatus), updateOrderStatus);
router.put('/orders/:orderId/assign-staff', assignStaffToOrder);

// Staff Management
router.get('/staff', getStaff);
router.post('/staff', validate(staffValidation.createStaff), createStaff);
router.put('/staff/:staffId', validate(staffValidation.updateStaff), updateStaff);

// Inventory Management
router.get('/inventory', getInventory);
router.put('/inventory/:itemId', updateInventory);
router.post('/inventory/restock-request', requestRestock);

module.exports = router;