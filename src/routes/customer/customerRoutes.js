const express = require('express');
const auth = require('../../middlewares/auth');
const { isCustomer } = require('../../middlewares/roleCheck');

// Import customer route modules
const addressRoutes = require('./addressRoutes');
const orderRoutes = require('./orderRoutes');
const ticketRoutes = require('./ticketRoutes');
const notificationRoutes = require('./notificationRoutes');

const router = express.Router();

// Apply authentication and customer role check to all routes
router.use(auth);
router.use(isCustomer);

// Customer route modules
router.use('/addresses', addressRoutes);
router.use('/orders', orderRoutes);
router.use('/tickets', ticketRoutes);
router.use('/notifications', notificationRoutes);

module.exports = router;