const Ticket = require('../../models/Ticket');
const Order = require('../../models/Order');
const User = require('../../models/User');
const { 
  sendSuccess, 
  sendError, 
  asyncHandler,
  getPagination,
  formatPaginationResponse
} = require('../../utils/helpers');
const { TICKET_STATUS, TICKET_PRIORITY, USER_ROLES } = require('../../config/constants');

// @desc    Get support dashboard data
// @route   GET /api/support/dashboard
// @access  Private (Support Agent/Admin)
const getSupportDashboard = asyncHandler(async (req, res) => {
  const user = req.user;
  
  // Build query based on user role
  let ticketQuery = {};
  if (user.role === USER_ROLES.SUPPORT_AGENT) {
    // Support agents see only their assigned tickets + unassigned tickets
    ticketQuery = {
      $or: [
        { assignedTo: user._id },
        { assignedTo: { $exists: false } }
      ]
    };
  }
  // Admins see all tickets

  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));

  // Get dashboard metrics
  const [
    totalTickets,
    todayTickets,
    openTickets,
    inProgressTickets,
    overdueTickets,
    myAssignedTickets,
    avgResolutionTime
  ] = await Promise.all([
    Ticket.countDocuments(ticketQuery),
    Ticket.countDocuments({
      ...ticketQuery,
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    }),
    Ticket.countDocuments({
      ...ticketQuery,
      status: TICKET_STATUS.OPEN
    }),
    Ticket.countDocuments({
      ...ticketQuery,
      status: TICKET_STATUS.IN_PROGRESS
    }),
    Ticket.countDocuments({
      ...ticketQuery,
      'sla.isOverdue': true
    }),
    user.role === USER_ROLES.SUPPORT_AGENT 
      ? Ticket.countDocuments({ assignedTo: user._id })
      : 0,
    // TODO: Calculate actual average resolution time
    24 // Mock value in hours
  ]);

  // Get recent tickets
  const recentTickets = await Ticket.find(ticketQuery)
    .populate('raisedBy', 'name email')
    .populate('assignedTo', 'name')
    .populate('relatedOrder', 'orderNumber')
    .sort({ createdAt: -1 })
    .limit(10)
    .select('ticketNumber title status priority createdAt');

  // Get ticket distribution by category
  const categoryDistribution = await Ticket.aggregate([
    { $match: ticketQuery },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 }
      }
    }
  ]);

  const dashboardData = {
    metrics: {
      totalTickets,
      todayTickets,
      openTickets,
      inProgressTickets,
      overdueTickets,
      myAssignedTickets,
      avgResolutionTime
    },
    recentTickets,
    categoryDistribution
  };

  sendSuccess(res, dashboardData, 'Support dashboard data retrieved successfully');
});

// @desc    Get tickets
// @route   GET /api/support/tickets
// @access  Private (Support Agent/Admin)
const getTickets = asyncHandler(async (req, res) => {
  const user = req.user;
  const { 
    page = 1, 
    limit = 20, 
    status, 
    priority, 
    category,
    assignedTo,
    search,
    isOverdue
  } = req.query;

  const { skip, limit: limitNum, page: pageNum } = getPagination(page, limit);

  // Build query based on user role
  let query = {};
  if (user.role === USER_ROLES.SUPPORT_AGENT) {
    // Support agents see only their assigned tickets + unassigned tickets
    query = {
      $or: [
        { assignedTo: user._id },
        { assignedTo: { $exists: false } }
      ]
    };
  }

  // Apply filters
  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (category) query.category = category;
  if (assignedTo) query.assignedTo = assignedTo;
  if (isOverdue === 'true') query['sla.isOverdue'] = true;

  if (search) {
    query.$and = query.$and || [];
    query.$and.push({
      $or: [
        { ticketNumber: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ]
    });
  }

  const total = await Ticket.countDocuments(query);
  const tickets = await Ticket.find(query)
    .populate('raisedBy', 'name email phone')
    .populate('assignedTo', 'name')
    .populate('relatedOrder', 'orderNumber status')
    .sort({ 
      priority: -1, // High priority first
      createdAt: -1 
    })
    .skip(skip)
    .limit(limitNum);

  const response = formatPaginationResponse(tickets, total, pageNum, limitNum);
  sendSuccess(res, response, 'Tickets retrieved successfully');
});

// @desc    Get ticket by ID
// @route   GET /api/support/tickets/:ticketId
// @access  Private (Support Agent/Admin)
const getTicketById = asyncHandler(async (req, res) => {
  const { ticketId } = req.params;
  const user = req.user;

  const ticket = await Ticket.findById(ticketId)
    .populate('raisedBy', 'name email phone')
    .populate('assignedTo', 'name email')
    .populate('resolvedBy', 'name')
    .populate('escalatedTo', 'name')
    .populate('relatedOrder', 'orderNumber status customer branch')
    .populate('messages.sender', 'name role');

  if (!ticket) {
    return sendError(res, 'TICKET_NOT_FOUND', 'Ticket not found', 404);
  }

  // Check access for support agents
  if (user.role === USER_ROLES.SUPPORT_AGENT) {
    if (ticket.assignedTo && ticket.assignedTo._id.toString() !== user._id.toString()) {
      return sendError(res, 'FORBIDDEN', 'Access denied to this ticket', 403);
    }
  }

  // Check if ticket is overdue
  ticket.checkOverdue();
  if (ticket.sla.isOverdue) {
    await ticket.save();
  }

  sendSuccess(res, { ticket }, 'Ticket retrieved successfully');
});

// @desc    Update ticket status
// @route   PUT /api/support/tickets/:ticketId/status
// @access  Private (Support Agent/Admin)
const updateTicketStatus = asyncHandler(async (req, res) => {
  const { ticketId } = req.params;
  const { status, priority } = req.body;
  const user = req.user;

  const ticket = await Ticket.findById(ticketId);
  if (!ticket) {
    return sendError(res, 'TICKET_NOT_FOUND', 'Ticket not found', 404);
  }

  // Check access for support agents
  if (user.role === USER_ROLES.SUPPORT_AGENT) {
    if (ticket.assignedTo && ticket.assignedTo.toString() !== user._id.toString()) {
      return sendError(res, 'FORBIDDEN', 'Access denied to this ticket', 403);
    }
  }

  // Update fields
  if (status) ticket.status = status;
  if (priority) ticket.priority = priority;

  // Auto-assign to current user if not assigned and status is IN_PROGRESS
  if (status === TICKET_STATUS.IN_PROGRESS && !ticket.assignedTo) {
    ticket.assignedTo = user._id;
  }

  await ticket.save();

  const updatedTicket = await Ticket.findById(ticketId)
    .populate('assignedTo', 'name');

  sendSuccess(res, { ticket: updatedTicket }, 'Ticket status updated successfully');
});

// @desc    Assign ticket to support agent
// @route   PUT /api/support/tickets/:ticketId/assign
// @access  Private (Admin)
const assignTicket = asyncHandler(async (req, res) => {
  const { ticketId } = req.params;
  const { assignedTo } = req.body;

  if (!assignedTo) {
    return sendError(res, 'ASSIGNEE_REQUIRED', 'Assignee is required', 400);
  }

  const ticket = await Ticket.findById(ticketId);
  if (!ticket) {
    return sendError(res, 'TICKET_NOT_FOUND', 'Ticket not found', 404);
  }

  // Verify assignee is a support agent
  const assignee = await User.findOne({
    _id: assignedTo,
    role: { $in: [USER_ROLES.SUPPORT_AGENT, USER_ROLES.ADMIN] }
  });

  if (!assignee) {
    return sendError(res, 'INVALID_ASSIGNEE', 'Invalid assignee', 400);
  }

  ticket.assignedTo = assignedTo;
  if (ticket.status === TICKET_STATUS.OPEN) {
    ticket.status = TICKET_STATUS.IN_PROGRESS;
  }

  await ticket.save();

  const updatedTicket = await Ticket.findById(ticketId)
    .populate('assignedTo', 'name email');

  sendSuccess(res, { ticket: updatedTicket }, 'Ticket assigned successfully');
});

// @desc    Add message to ticket
// @route   POST /api/support/tickets/:ticketId/messages
// @access  Private (Support Agent/Admin)
const addMessageToTicket = asyncHandler(async (req, res) => {
  const { ticketId } = req.params;
  const { message, isInternal } = req.body;
  const user = req.user;

  const ticket = await Ticket.findById(ticketId);
  if (!ticket) {
    return sendError(res, 'TICKET_NOT_FOUND', 'Ticket not found', 404);
  }

  // Check access for support agents
  if (user.role === USER_ROLES.SUPPORT_AGENT) {
    if (ticket.assignedTo && ticket.assignedTo.toString() !== user._id.toString()) {
      return sendError(res, 'FORBIDDEN', 'Access denied to this ticket', 403);
    }
  }

  await ticket.addMessage(user._id, message, isInternal || false);

  const updatedTicket = await Ticket.findById(ticketId)
    .populate('messages.sender', 'name role')
    .select('messages');

  sendSuccess(res, { 
    messages: updatedTicket.messages 
  }, 'Message added successfully');
});

// @desc    Escalate ticket
// @route   PUT /api/support/tickets/:ticketId/escalate
// @access  Private (Support Agent/Admin)
const escalateTicket = asyncHandler(async (req, res) => {
  const { ticketId } = req.params;
  const { escalatedTo, reason } = req.body;
  const user = req.user;

  if (!escalatedTo || !reason) {
    return sendError(res, 'MISSING_DATA', 'Escalated to and reason are required', 400);
  }

  const ticket = await Ticket.findById(ticketId);
  if (!ticket) {
    return sendError(res, 'TICKET_NOT_FOUND', 'Ticket not found', 404);
  }

  // Verify escalation target
  const escalationTarget = await User.findOne({
    _id: escalatedTo,
    role: { $in: [USER_ROLES.ADMIN, USER_ROLES.CENTER_ADMIN] }
  });

  if (!escalationTarget) {
    return sendError(res, 'INVALID_ESCALATION_TARGET', 'Invalid escalation target', 400);
  }

  await ticket.escalate(escalatedTo, reason);

  const updatedTicket = await Ticket.findById(ticketId)
    .populate('escalatedTo', 'name email');

  sendSuccess(res, { ticket: updatedTicket }, 'Ticket escalated successfully');
});

// @desc    Resolve ticket
// @route   PUT /api/support/tickets/:ticketId/resolve
// @access  Private (Support Agent/Admin)
const resolveTicket = asyncHandler(async (req, res) => {
  const { ticketId } = req.params;
  const { resolution } = req.body;
  const user = req.user;

  if (!resolution) {
    return sendError(res, 'RESOLUTION_REQUIRED', 'Resolution is required', 400);
  }

  const ticket = await Ticket.findById(ticketId);
  if (!ticket) {
    return sendError(res, 'TICKET_NOT_FOUND', 'Ticket not found', 404);
  }

  // Check access for support agents
  if (user.role === USER_ROLES.SUPPORT_AGENT) {
    if (ticket.assignedTo && ticket.assignedTo.toString() !== user._id.toString()) {
      return sendError(res, 'FORBIDDEN', 'Access denied to this ticket', 403);
    }
  }

  await ticket.resolve(user._id, resolution);

  const updatedTicket = await Ticket.findById(ticketId)
    .populate('resolvedBy', 'name');

  sendSuccess(res, { ticket: updatedTicket }, 'Ticket resolved successfully');
});

module.exports = {
  getSupportDashboard,
  getTickets,
  getTicketById,
  updateTicketStatus,
  assignTicket,
  addMessageToTicket,
  escalateTicket,
  resolveTicket
};