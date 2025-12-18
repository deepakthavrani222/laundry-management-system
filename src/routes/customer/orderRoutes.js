const express = require('express');
const {
  createOrder,
  getOrders,
  getOrderById,
  cancelOrder,
  rateOrder,
  reorder,
  getOrderTracking
} = require('../../controllers/customer/orderController');
const { validate, orderValidation } = require('../../utils/validators');

const router = express.Router();

router.post('/', validate(orderValidation.createOrder), createOrder);
router.get('/', getOrders);
router.get('/:orderId', getOrderById);
router.get('/:orderId/tracking', getOrderTracking);
router.put('/:orderId/cancel', cancelOrder);
router.put('/:orderId/rate', validate(orderValidation.rateOrder), rateOrder);
router.post('/:orderId/reorder', reorder);

module.exports = router;