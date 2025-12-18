const express = require('express');
const {
  getCustomerTickets,
  createTicket,
  getTicketById,
  addMessageToTicket,
  rateTicketResolution
} = require('../../controllers/customer/ticketController');
const { validate, ticketValidation } = require('../../utils/validators');

const router = express.Router();

router.get('/', getCustomerTickets);
router.post('/', validate(ticketValidation.createTicket), createTicket);
router.get('/:ticketId', getTicketById);
router.post('/:ticketId/messages', validate(ticketValidation.addMessage), addMessageToTicket);
router.put('/:ticketId/rate', rateTicketResolution);

module.exports = router;