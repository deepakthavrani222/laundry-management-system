const User = require('../models/User');
const { generateToken, sendSuccess, sendError, asyncHandler } = require('../utils/helpers');
const { USER_ROLES } = require('../config/constants');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const register = asyncHandler(async (req, res) => {
  const { name, email, phone, password, role } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({
    $or: [{ email }, { phone }]
  });

  if (existingUser) {
    return sendError(res, 'USER_EXISTS', 'User with this email or phone already exists', 400);
  }

  // Create user
  const user = await User.create({
    name,
    email,
    phone,
    password,
    role: role || USER_ROLES.CUSTOMER
  });

  // Generate token
  const token = generateToken(user._id);

  // Remove password from response
  user.password = undefined;

  sendSuccess(res, {
    token,
    user
  }, 'User registered successfully', 201);
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = asyncHandler(async (req, res) => {
  const { email, phone, password } = req.body;

  // Find user by email or phone
  const query = email ? { email } : { phone };
  const user = await User.findOne(query).select('+password');

  if (!user) {
    return sendError(res, 'INVALID_CREDENTIALS', 'Invalid credentials', 401);
  }

  // Check if account is active
  if (!user.isActive) {
    return sendError(res, 'ACCOUNT_DISABLED', 'Account has been disabled', 401);
  }

  // Check password
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    return sendError(res, 'INVALID_CREDENTIALS', 'Invalid credentials', 401);
  }

  // Update last login
  await user.updateLastLogin();

  // Generate token
  const token = generateToken(user._id);

  // Remove password from response
  user.password = undefined;

  sendSuccess(res, {
    token,
    user
  }, 'Login successful');
});

// @desc    Get current user profile
// @route   GET /api/auth/profile
// @access  Private
const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate('assignedBranch', 'name code')
    .select('-password');

  sendSuccess(res, { user }, 'Profile retrieved successfully');
});

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = asyncHandler(async (req, res) => {
  const { name, email, phone, preferences } = req.body;

  // Check if email/phone is already taken by another user
  if (email || phone) {
    const query = {
      _id: { $ne: req.user._id },
      $or: []
    };

    if (email) query.$or.push({ email });
    if (phone) query.$or.push({ phone });

    const existingUser = await User.findOne(query);
    if (existingUser) {
      return sendError(res, 'USER_EXISTS', 'Email or phone already taken', 400);
    }
  }

  // Update user
  const updateData = {};
  if (name) updateData.name = name;
  if (email) updateData.email = email;
  if (phone) updateData.phone = phone;
  if (preferences) updateData.preferences = preferences;

  const user = await User.findByIdAndUpdate(
    req.user._id,
    updateData,
    { new: true, runValidators: true }
  ).select('-password');

  sendSuccess(res, { user }, 'Profile updated successfully');
});

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  // Get user with password
  const user = await User.findById(req.user._id).select('+password');

  // Check current password
  const isCurrentPasswordValid = await user.comparePassword(currentPassword);
  if (!isCurrentPasswordValid) {
    return sendError(res, 'INVALID_PASSWORD', 'Current password is incorrect', 400);
  }

  // Update password
  user.password = newPassword;
  await user.save();

  sendSuccess(res, null, 'Password changed successfully');
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logout = asyncHandler(async (req, res) => {
  // In a real implementation, you might want to blacklist the token
  // For now, we'll just send a success response
  sendSuccess(res, null, 'Logged out successfully');
});

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  logout
};