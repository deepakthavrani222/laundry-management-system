const express = require('express');
const { register, login, getProfile, updateProfile, changePassword, logout } = require('../controllers/authController');
const { validate, authValidation, userValidation } = require('../utils/validators');
const auth = require('../middlewares/auth');

const router = express.Router();

// Public routes
router.post('/register', validate(authValidation.register), register);
router.post('/login', validate(authValidation.login), login);

// Protected routes
router.use(auth); // All routes below require authentication

router.get('/profile', getProfile);
router.put('/profile', validate(userValidation.updateProfile), updateProfile);
router.put('/change-password', validate(authValidation.changePassword), changePassword);
router.post('/logout', logout);

module.exports = router;