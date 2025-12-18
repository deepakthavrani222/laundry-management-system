const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  console.error('Error:', err);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Invalid ID format';
    error = {
      success: false,
      error: 'INVALID_ID',
      message,
      statusCode: 400
    };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `${field} already exists`;
    error = {
      success: false,
      error: 'DUPLICATE_FIELD',
      message,
      statusCode: 400
    };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = {
      success: false,
      error: 'VALIDATION_ERROR',
      message,
      statusCode: 400
    };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = {
      success: false,
      error: 'INVALID_TOKEN',
      message: 'Invalid token',
      statusCode: 401
    };
  }

  if (err.name === 'TokenExpiredError') {
    error = {
      success: false,
      error: 'TOKEN_EXPIRED',
      message: 'Token expired',
      statusCode: 401
    };
  }

  // Default error response
  res.status(error.statusCode || 500).json({
    success: false,
    error: error.error || 'SERVER_ERROR',
    message: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;