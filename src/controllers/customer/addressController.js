const User = require('../../models/User');
const { sendSuccess, sendError, asyncHandler } = require('../../utils/helpers');

// @desc    Get all addresses for customer
// @route   GET /api/customer/addresses
// @access  Private (Customer)
const getAddresses = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('addresses');
  
  sendSuccess(res, { addresses: user.addresses }, 'Addresses retrieved successfully');
});

// @desc    Add new address
// @route   POST /api/customer/addresses
// @access  Private (Customer)
const addAddress = asyncHandler(async (req, res) => {
  const addressData = req.body;
  
  const user = await User.findById(req.user._id);
  
  // If this is the first address or isDefault is true, make it default
  if (user.addresses.length === 0 || addressData.isDefault) {
    // Remove default from other addresses
    user.addresses.forEach(addr => addr.isDefault = false);
    addressData.isDefault = true;
  }
  
  user.addresses.push(addressData);
  await user.save();
  
  const newAddress = user.addresses[user.addresses.length - 1];
  
  sendSuccess(res, { address: newAddress }, 'Address added successfully', 201);
});

// @desc    Update address
// @route   PUT /api/customer/addresses/:addressId
// @access  Private (Customer)
const updateAddress = asyncHandler(async (req, res) => {
  const { addressId } = req.params;
  const updateData = req.body;
  
  const user = await User.findById(req.user._id);
  const address = user.addresses.id(addressId);
  
  if (!address) {
    return sendError(res, 'ADDRESS_NOT_FOUND', 'Address not found', 404);
  }
  
  // If setting as default, remove default from others
  if (updateData.isDefault) {
    user.addresses.forEach(addr => addr.isDefault = false);
  }
  
  // Update address fields
  Object.keys(updateData).forEach(key => {
    if (updateData[key] !== undefined) {
      address[key] = updateData[key];
    }
  });
  
  await user.save();
  
  sendSuccess(res, { address }, 'Address updated successfully');
});

// @desc    Delete address
// @route   DELETE /api/customer/addresses/:addressId
// @access  Private (Customer)
const deleteAddress = asyncHandler(async (req, res) => {
  const { addressId } = req.params;
  
  const user = await User.findById(req.user._id);
  const address = user.addresses.id(addressId);
  
  if (!address) {
    return sendError(res, 'ADDRESS_NOT_FOUND', 'Address not found', 404);
  }
  
  const wasDefault = address.isDefault;
  address.remove();
  
  // If deleted address was default, make first remaining address default
  if (wasDefault && user.addresses.length > 0) {
    user.addresses[0].isDefault = true;
  }
  
  await user.save();
  
  sendSuccess(res, null, 'Address deleted successfully');
});

// @desc    Set address as default
// @route   PUT /api/customer/addresses/:addressId/set-default
// @access  Private (Customer)
const setDefaultAddress = asyncHandler(async (req, res) => {
  const { addressId } = req.params;
  
  const user = await User.findById(req.user._id);
  const address = user.addresses.id(addressId);
  
  if (!address) {
    return sendError(res, 'ADDRESS_NOT_FOUND', 'Address not found', 404);
  }
  
  // Remove default from all addresses
  user.addresses.forEach(addr => addr.isDefault = false);
  
  // Set this address as default
  address.isDefault = true;
  
  await user.save();
  
  sendSuccess(res, { address }, 'Default address updated successfully');
});

module.exports = {
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress
};