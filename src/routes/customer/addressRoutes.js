const express = require('express');
const {
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress
} = require('../../controllers/customer/addressController');
const { validate, userValidation } = require('../../utils/validators');

const router = express.Router();

router.get('/', getAddresses);
router.post('/', validate(userValidation.addAddress), addAddress);
router.put('/:addressId', updateAddress);
router.delete('/:addressId', deleteAddress);
router.put('/:addressId/set-default', setDefaultAddress);

module.exports = router;