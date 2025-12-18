const Order = require('../../models/Order');
const User = require('../../models/User');
const Branch = require('../../models/Branch');
const Ticket = require('../../models/Ticket');
const Staff = require('../../models/Staff');
const { 
  sendSuccess, 
  sendError, 
  asyncHandler,
  getPagination,
  formatPaginationResponse
} = require('../../utils/helpers');
const { ORDER_STATUS, USER_ROLES, TICKET_STATUS } = require('../../config/constants');

// @desc    Get center admin dashboard data
// @route   GET /api/center-admin/dashboard
// @access  Private (Center Admin)
const getCenterAdminDashboard = asyncHandler(async (req, res) => {
  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // Get system-wide metrics
  const [
    totalOrders,
    todayOrders,
    monthlyOrders,
    totalRevenue,
    monthlyRevenue,
    totalCustomers,
    activeCustomers,
    totalBranches,
    activeBranches,
    totalStaff,
    pendingTickets,
    escalatedTickets
  ] = await Promise.all([
    Order.countDocuments(),
    Order.countDocuments({ createdAt: { $gte: startOfDay, $lte: endOfDay } }),
    Order.countDocuments({ createdAt: { $gte: startOfMonth } }),
    Order.aggregate([
      { $match: { status: ORDER_STATUS.DELIVERED } },
      { $group: { _id: null, total: { $sum: '$pricing.total' } } }
    ]).then(result => result[0]?.total || 0),
    Order.aggregate([
      { 
        $match: { 
          status: ORDER_STATUS.DELIVERED,
          createdAt: { $gte: startOfMonth }
        } 
      },
      { $group: { _id: null, total: { $sum: '$pricing.total' } } }
    ]).then(result => result[0]?.total || 0),
    User.countDocuments({ role: USER_ROLES.CUSTOMER }),
    User.countDocuments({ role: USER_ROLES.CUSTOMER, isActive: true }),
    Branch.countDocuments(),
    Branch.countDocuments({ isActive: true }),
    Staff.countDocuments({ isActive: true }),
    Ticket.countDocuments({ status: { $in: [TICKET_STATUS.OPEN, TICKET_STATUS.IN_PROGRESS] } }),
    Ticket.countDocuments({ status: TICKET_STATUS.ESCALATED })
  ]);

  // Get branch performance
  const branchPerformance = await Branch.aggregate([
    {
      $lookup: {
        from: 'orders',
        localField: '_id',
        foreignField: 'branch',
        as: 'orders'
      }
    },
    {
      $project: {
        name: 1,
        code: 1,
        isActive: 1,
        totalOrders: { $size: '$orders' },
        completedOrders: {
          $size: {
            $filter: {
              input: '$orders',
              cond: { $eq: ['$$this.status', ORDER_STATUS.DELIVERED] }
            }
          }
        },
        revenue: {
          $sum: {
            $map: {
              input: {
                $filter: {
                  input: '$orders',
                  cond: { $eq: ['$$this.status', ORDER_STATUS.DELIVERED] }
                }
              },
              as: 'order',
              in: '$$order.pricing.total'
            }
          }
        }
      }
    },
    { $sort: { revenue: -1 } },
    { $limit: 5 }
  ]);

  // Get order status distribution
  const statusDistribution = await Order.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  // Get daily revenue for last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const dailyRevenue = await Order.aggregate([
    {
      $match: {
        status: ORDER_STATUS.DELIVERED,
        createdAt: { $gte: thirtyDaysAgo }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
        },
        revenue: { $sum: '$pricing.total' },
        orders: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  const dashboardData = {
    metrics: {
      totalOrders,
      todayOrders,
      monthlyOrders,
      totalRevenue,
      monthlyRevenue,
      totalCustomers,
      activeCustomers,
      totalBranches,
      activeBranches,
      totalStaff,
      pendingTickets,
      escalatedTickets
    },
    branchPerformance,
    statusDistribution,
    dailyRevenue
  };

  sendSuccess(res, dashboardData, 'Center admin dashboard data retrieved successfully');
});

// @desc    Get all branches
// @route   GET /api/center-admin/branches
// @access  Private (Center Admin)
const getBranches = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, isActive } = req.query;
  const { skip, limit: limitNum, page: pageNum } = getPagination(page, limit);

  const query = {};
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { code: { $regex: search, $options: 'i' } },
      { 'address.city': { $regex: search, $options: 'i' } }
    ];
  }
  if (isActive !== undefined) query.isActive = isActive === 'true';

  const total = await Branch.countDocuments(query);
  const branches = await Branch.find(query)
    .populate('manager', 'name email phone')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  // Get order counts for each branch
  const branchesWithStats = await Promise.all(
    branches.map(async (branch) => {
      const [totalOrders, completedOrders, revenue] = await Promise.all([
        Order.countDocuments({ branch: branch._id }),
        Order.countDocuments({ branch: branch._id, status: ORDER_STATUS.DELIVERED }),
        Order.aggregate([
          { $match: { branch: branch._id, status: ORDER_STATUS.DELIVERED } },
          { $group: { _id: null, total: { $sum: '$pricing.total' } } }
        ]).then(result => result[0]?.total || 0)
      ]);

      return {
        ...branch.toObject(),
        stats: {
          totalOrders,
          completedOrders,
          revenue
        }
      };
    })
  );

  const response = formatPaginationResponse(branchesWithStats, total, pageNum, limitNum);
  sendSuccess(res, response, 'Branches retrieved successfully');
});

// @desc    Create new branch
// @route   POST /api/center-admin/branches
// @access  Private (Center Admin)
const createBranch = asyncHandler(async (req, res) => {
  const branchData = req.body;

  // Check if branch code already exists
  const existingBranch = await Branch.findOne({ code: branchData.code });
  if (existingBranch) {
    return sendError(res, 'BRANCH_CODE_EXISTS', 'Branch code already exists', 400);
  }

  // Validate manager if provided
  if (branchData.managerId) {
    const manager = await User.findOne({
      _id: branchData.managerId,
      role: USER_ROLES.BRANCH_MANAGER
    });

    if (!manager) {
      return sendError(res, 'INVALID_MANAGER', 'Invalid branch manager', 400);
    }

    // Check if manager is already assigned to another branch
    const existingAssignment = await Branch.findOne({ manager: branchData.managerId });
    if (existingAssignment) {
      return sendError(res, 'MANAGER_ALREADY_ASSIGNED', 'Manager is already assigned to another branch', 400);
    }
  }

  const branch = await Branch.create({
    ...branchData,
    manager: branchData.managerId
  });

  // Update manager's assigned branch
  if (branchData.managerId) {
    await User.findByIdAndUpdate(branchData.managerId, {
      assignedBranch: branch._id
    });
  }

  const populatedBranch = await Branch.findById(branch._id)
    .populate('manager', 'name email phone');

  sendSuccess(res, { branch: populatedBranch }, 'Branch created successfully', 201);
});

// @desc    Update branch
// @route   PUT /api/center-admin/branches/:branchId
// @access  Private (Center Admin)
const updateBranch = asyncHandler(async (req, res) => {
  const { branchId } = req.params;
  const updateData = req.body;

  const branch = await Branch.findById(branchId);
  if (!branch) {
    return sendError(res, 'BRANCH_NOT_FOUND', 'Branch not found', 404);
  }

  // Update branch
  Object.keys(updateData).forEach(key => {
    if (updateData[key] !== undefined) {
      if (key === 'address' || key === 'contact' || key === 'capacity') {
        branch[key] = { ...branch[key], ...updateData[key] };
      } else {
        branch[key] = updateData[key];
      }
    }
  });

  await branch.save();

  const updatedBranch = await Branch.findById(branchId)
    .populate('manager', 'name email phone');

  sendSuccess(res, { branch: updatedBranch }, 'Branch updated successfully');
});

// @desc    Toggle branch status
// @route   PUT /api/center-admin/branches/:branchId/toggle-status
// @access  Private (Center Admin)
const toggleBranchStatus = asyncHandler(async (req, res) => {
  const { branchId } = req.params;

  const branch = await Branch.findById(branchId);
  if (!branch) {
    return sendError(res, 'BRANCH_NOT_FOUND', 'Branch not found', 404);
  }

  branch.isActive = !branch.isActive;
  await branch.save();

  sendSuccess(res, { 
    branch: { 
      _id: branch._id, 
      name: branch.name, 
      isActive: branch.isActive 
    } 
  }, `Branch ${branch.isActive ? 'activated' : 'deactivated'} successfully`);
});

// @desc    Get all users
// @route   GET /api/center-admin/users
// @access  Private (Center Admin)
const getUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, role, search, isActive } = req.query;
  const { skip, limit: limitNum, page: pageNum } = getPagination(page, limit);

  const query = {};
  if (role) query.role = role;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } }
    ];
  }
  if (isActive !== undefined) query.isActive = isActive === 'true';

  const total = await User.countDocuments(query);
  const users = await User.find(query)
    .populate('assignedBranch', 'name code')
    .select('-password')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  const response = formatPaginationResponse(users, total, pageNum, limitNum);
  sendSuccess(res, response, 'Users retrieved successfully');
});

// @desc    Create new user
// @route   POST /api/center-admin/users
// @access  Private (Center Admin)
const createUser = asyncHandler(async (req, res) => {
  const { name, email, phone, password, role, assignedBranch } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({
    $or: [{ email }, { phone }]
  });

  if (existingUser) {
    return sendError(res, 'USER_EXISTS', 'User with this email or phone already exists', 400);
  }

  // Validate branch assignment for branch manager
  if (role === USER_ROLES.BRANCH_MANAGER && assignedBranch) {
    const branch = await Branch.findById(assignedBranch);
    if (!branch) {
      return sendError(res, 'BRANCH_NOT_FOUND', 'Branch not found', 404);
    }

    // Check if branch already has a manager
    const existingManager = await User.findOne({
      role: USER_ROLES.BRANCH_MANAGER,
      assignedBranch
    });

    if (existingManager) {
      return sendError(res, 'BRANCH_HAS_MANAGER', 'Branch already has a manager', 400);
    }
  }

  const user = await User.create({
    name,
    email,
    phone,
    password,
    role,
    assignedBranch: role === USER_ROLES.BRANCH_MANAGER ? assignedBranch : undefined
  });

  // Update branch manager reference
  if (role === USER_ROLES.BRANCH_MANAGER && assignedBranch) {
    await Branch.findByIdAndUpdate(assignedBranch, { manager: user._id });
  }

  // Remove password from response
  user.password = undefined;

  sendSuccess(res, { user }, 'User created successfully', 201);
});

// @desc    Update user role
// @route   PUT /api/center-admin/users/:userId/role
// @access  Private (Center Admin)
const updateUserRole = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { role, assignedBranch } = req.body;

  const user = await User.findById(userId);
  if (!user) {
    return sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
  }

  // Handle branch manager role changes
  if (user.role === USER_ROLES.BRANCH_MANAGER && user.assignedBranch) {
    // Remove manager from old branch
    await Branch.findByIdAndUpdate(user.assignedBranch, { $unset: { manager: 1 } });
  }

  if (role === USER_ROLES.BRANCH_MANAGER && assignedBranch) {
    // Validate new branch
    const branch = await Branch.findById(assignedBranch);
    if (!branch) {
      return sendError(res, 'BRANCH_NOT_FOUND', 'Branch not found', 404);
    }

    // Check if branch already has a manager
    const existingManager = await User.findOne({
      _id: { $ne: userId },
      role: USER_ROLES.BRANCH_MANAGER,
      assignedBranch
    });

    if (existingManager) {
      return sendError(res, 'BRANCH_HAS_MANAGER', 'Branch already has a manager', 400);
    }

    // Update branch manager reference
    await Branch.findByIdAndUpdate(assignedBranch, { manager: userId });
  }

  // Update user
  user.role = role;
  user.assignedBranch = role === USER_ROLES.BRANCH_MANAGER ? assignedBranch : undefined;
  await user.save();

  const updatedUser = await User.findById(userId)
    .populate('assignedBranch', 'name code')
    .select('-password');

  sendSuccess(res, { user: updatedUser }, 'User role updated successfully');
});

// @desc    Toggle user status
// @route   PUT /api/center-admin/users/:userId/toggle-status
// @access  Private (Center Admin)
const toggleUserStatus = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId);
  if (!user) {
    return sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
  }

  user.isActive = !user.isActive;
  await user.save();

  sendSuccess(res, { 
    user: { 
      _id: user._id, 
      name: user.name, 
      isActive: user.isActive 
    } 
  }, `User ${user.isActive ? 'activated' : 'deactivated'} successfully`);
});

// @desc    Get system analytics
// @route   GET /api/center-admin/analytics
// @access  Private (Center Admin)
const getSystemAnalytics = asyncHandler(async (req, res) => {
  // This would contain detailed analytics
  // For now, return basic data
  const analytics = {
    customerRetention: 85, // Mock percentage
    averageOrderValue: 450, // Mock value
    peakHours: ['10:00-12:00', '15:00-17:00'], // Mock data
    topServices: [
      { service: 'washing', count: 1250 },
      { service: 'dry_cleaning', count: 890 },
      { service: 'ironing', count: 650 }
    ]
  };

  sendSuccess(res, analytics, 'System analytics retrieved successfully');
});

// @desc    Get financial reports
// @route   GET /api/center-admin/reports/financial
// @access  Private (Center Admin)
const getFinancialReports = asyncHandler(async (req, res) => {
  const { startDate, endDate, branchId } = req.query;

  const query = { status: ORDER_STATUS.DELIVERED };
  
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }
  
  if (branchId) query.branch = branchId;

  const [totalRevenue, totalOrders, averageOrderValue] = await Promise.all([
    Order.aggregate([
      { $match: query },
      { $group: { _id: null, total: { $sum: '$pricing.total' } } }
    ]).then(result => result[0]?.total || 0),
    Order.countDocuments(query),
    Order.aggregate([
      { $match: query },
      { $group: { _id: null, avg: { $avg: '$pricing.total' } } }
    ]).then(result => result[0]?.avg || 0)
  ]);

  const report = {
    totalRevenue,
    totalOrders,
    averageOrderValue: Math.round(averageOrderValue),
    period: {
      startDate: startDate || 'All time',
      endDate: endDate || 'Present'
    }
  };

  sendSuccess(res, report, 'Financial report generated successfully');
});

module.exports = {
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
};