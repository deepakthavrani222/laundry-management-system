const express = require('express');
const auth = require('../../middlewares/auth');
const { isSupportOrAdmin } = require('../../middlewares/roleCheck');

// Import support controllers
const {
  getSupportDashboard,
  getTickets,
  getTicketById,
  updateTicketStatus,
  assignTicket,
  addMessageToTicket,
  escalateTicket,
  resolveTicket
} = require('../../controllers/support/supportController');

const { validate, ticketValidation } = require('../../utils/validators');

const router = express.Router();

// Apply authentication and support role check
router.use(auth);
router.use(isSupportOrAdmin);

// Dashboard
router.get('/dashboard', getSupportDashboard);

// Ticket Management
router.get('/tickets', getTickets);
router.get('/tickets/:ticketId', getTicketById);
router.put('/tickets/:ticketId/status', validate(ticketValidation.updateTicket), updateTicketStatus);
router.put('/tickets/:ticketId/assign', assignTicket);
router.post('/tickets/:ticketId/messages', validate(ticketValidation.addMessage), addMessageToTicket);
router.put('/tickets/:ticketId/escalate', escalateTicket);
router.put('/tickets/:ticketId/resolve', resolveTicket);

module.exports = router;