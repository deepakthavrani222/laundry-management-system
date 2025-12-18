const express = require('express');
const auth = require('../../middlewares/auth');
const { isCenterAdmin } = require('../../middlewares/roleCheck');

// Import center admin controllers
const {
  getCenterAdminDashboard,
  getBranches,
  createBranch,
  updateBranch,
  toggleBranchStatus,
  getUsers,
  createUser,
  updateUserRole,
  toggleUserStatus,
  getSystemAnalytics,
  getFinancialReports
} = require('../../controllers/centerAdmin/centerAdminController');

const { validate, branchValidation, userValidation } = require('../../utils/validators');

const router = express.Router();

// Apply authentication and center admin role check
router.use(auth);
router.use(isCenterAdmin);

// Dashboard & Analytics
router.get('/dashboard', getCenterAdminDashboard);
router.get('/analytics', getSystemAnalytics);
router.get('/reports/financial', getFinancialReports);

// Branch Management
router.get('/branches', getBranches);
router.post('/branches', validate(branchValidation.createBranch), createBranch);
router.put('/branches/:branchId', validate(branchValidation.updateBranch), updateBranch);
router.put('/branches/:branchId/toggle-status', toggleBranchStatus);

// User Management
router.get('/users', getUsers);
router.post('/users', createUser);
router.put('/users/:userId/role', updateUserRole);
router.put('/users/:userId/toggle-status', toggleUserStatus);

module.exports = router;