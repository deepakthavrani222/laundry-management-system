const Ticket = require('../../models/Ticket');
const Order = require('../../models/Order');
const { 
  sendSuccess, 
  sendError, 
  asyncHandler,
  getPagination,
  formatPaginationResponse
} = require('../../utils/helpers');
const { TICKET_STATUS, TICKET_PRIORITY } = require('../../config/constants');

// @desc    Get customer tickets
// @route   GET /api/customer/tickets
// @access  Private (Customer)
const getCustomerTickets = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const { skip, limit: limitNum, page: pageNum } = getPagination(page, limit);

  const query = { raisedBy: req.user._id };
  if (status) query.status = status;

  const total = await Ticket.countDocuments(query);
  const tickets = await Ticket.find(query)
    .populate('assignedTo', 'name')
    .populate('relatedOrder', 'orderNumber status')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum)
    .select('-messages'); // Exclude messages from list view

  const response = formatPaginationResponse(tickets, total, pageNum, limitNum);
  sendSuccess(res, response, 'Tickets retrieved successfully');
});

// @desc    Create new ticket
// @route   POST /api/customer/tickets
// @access  Private (Customer)
const createTicket = asyncHandler(async (req, res) => {
  const { title, description, category, priority, relatedOrderId } = req.body;

  // Validate related order if provided
  if (relatedOrderId) {
    const order = await Order.findOne({
      _id: relatedOrderId,
      customer: req.user._id
    });

    if (!order) {
      return sendError(res, 'ORDER_NOT_FOUND', 'Related order not found', 404);
    }
  }

  const ticket = await Ticket.create({
    title,
    description,
    category,
    priority: priority || TICKET_PRIORITY.MEDIUM,
    raisedBy: req.user._id,
    relatedOrder: relatedOrderId || undefined
  });

  const populatedTicket = await Ticket.findById(ticket._id)
    .populate('relatedOrder', 'orderNumber status');

  sendSuccess(res, { ticket: populatedTicket }, 'Ticket created successfully', 201);
});

// @desc    Get ticket by ID
// @route   GET /api/customer/tickets/:ticketId
// @access  Private (Customer)
const getTicketById = asyncHandler(async (req, res) => {
  const { ticketId } = req.params;

  const ticket = await Ticket.findOne({
    _id: ticketId,
    raisedBy: req.user._id
  })
    .populate('assignedTo', 'name')
    .populate('resolvedBy', 'name')
    .populate('relatedOrder', 'orderNumber status')
    .populate('messages.sender', 'name role');

  if (!ticket) {
    return sendError(res, 'TICKET_NOT_FOUND', 'Ticket not found', 404);
  }

  // Filter out internal messages for customer
  const filteredTicket = ticket.toObject();
  filteredTicket.messages = ticket.messages.filter(msg => !msg.isInternal);

  sendSuccess(res, { ticket: filteredTicket }, 'Ticket retrieved successfully');
});

// @desc    Add message to ticket
// @route   POST /api/customer/tickets/:ticketId/messages
// @access  Private (Customer)
const addMessageToTicket = asyncHandler(async (req, res) => {
  const { ticketId } = req.params;
  const { message } = req.body;

  const ticket = await Ticket.findOne({
    _id: ticketId,
    raisedBy: req.user._id
  });

  if (!ticket) {
    return sendError(res, 'TICKET_NOT_FOUND', 'Ticket not found', 404);
  }

  if (ticket.status === TICKET_STATUS.CLOSED) {
    return sendError(res, 'TICKET_CLOSED', 'Cannot add message to closed ticket', 400);
  }

  await ticket.addMessage(req.user._id, message, false);

  // If ticket was resolved, move it back to in progress
  if (ticket.status === TICKET_STATUS.RESOLVED) {
    ticket.status = TICKET_STATUS.IN_PROGRESS;
    await ticket.save();
  }

  const updatedTicket = await Ticket.findById(ticketId)
    .populate('messages.sender', 'name role')
    .select('messages status');

  // Filter out internal messages
  const filteredMessages = updatedTicket.messages.filter(msg => !msg.isInternal);

  sendSuccess(res, { 
    messages: filteredMessages,
    status: updatedTicket.status
  }, 'Message added successfully');
});

// @desc    Rate ticket resolution
// @route   PUT /api/customer/tickets/:ticketId/rate
// @access  Private (Customer)
const rateTicketResolution = asyncHandler(async (req, res) => {
  const { ticketId } = req.params;
  const { rating, comment } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return sendError(res, 'INVALID_RATING', 'Rating must be between 1 and 5', 400);
  }

  const ticket = await Ticket.findOne({
    _id: ticketId,
    raisedBy: req.user._id,
    status: TICKET_STATUS.RESOLVED
  });

  if (!ticket) {
    return sendError(res, 'TICKET_NOT_FOUND', 'Ticket not found or not resolved', 404);
  }

  if (ticket.feedback.rating) {
    return sendError(res, 'ALREADY_RATED', 'Ticket has already been rated', 400);
  }

  ticket.feedback = {
    rating,
    comment: comment || '',
    submittedAt: new Date()
  };

  ticket.status = TICKET_STATUS.CLOSED;
  await ticket.save();

  sendSuccess(res, { 
    feedback: ticket.feedback 
  }, 'Ticket rated successfully');
});

module.exports = {
  getCustomerTickets,
  createTicket,
  getTicketById,
  addMessageToTicket,
  rateTicketResolution
};