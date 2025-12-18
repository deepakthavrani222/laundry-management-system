const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const errorHandler = require('./middlewares/errorHandler');

// Import routes
const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customer/customerRoutes');
const adminRoutes = require('./routes/admin/adminRoutes');
const branchRoutes = require('./routes/branch/branchRoutes');
const supportRoutes = require('./routes/support/supportRoutes');
const centerAdminRoutes = require('./routes/centerAdmin/centerAdminRoutes');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Laundry Management API is running',
    timestamp: new Date().toISOString()
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/branch', branchRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/center-admin', centerAdminRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'ROUTE_NOT_FOUND',
    message: `Route ${req.originalUrl} not found`
  });
});

// Global error handler
app.use(errorHandler);

module.exports = app;