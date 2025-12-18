// User Roles
const USER_ROLES = {
  CUSTOMER: 'customer',
  ADMIN: 'admin',
  BRANCH_MANAGER: 'branch_manager',
  SUPPORT_AGENT: 'support_agent',
  CENTER_ADMIN: 'center_admin',
  STAFF: 'staff' // Washer/Ironer
};

// Order Status
const ORDER_STATUS = {
  PLACED: 'placed',
  ASSIGNED_TO_BRANCH: 'assigned_to_branch',
  ASSIGNED_TO_LOGISTICS_PICKUP: 'assigned_to_logistics_pickup',
  PICKED: 'picked',
  IN_PROCESS: 'in_process',
  READY: 'ready',
  ASSIGNED_TO_LOGISTICS_DELIVERY: 'assigned_to_logistics_delivery',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled'
};

// Services
const SERVICES = {
  WASHING: 'washing',
  DRY_CLEANING: 'dry_cleaning',
  IRONING: 'ironing'
};

// Clothing Categories
const CLOTHING_CATEGORIES = {
  NORMAL: 'normal',
  DELICATE: 'delicate',
  WOOLEN: 'woolen'
};

// Item Types
const ITEM_TYPES = {
  // Men's
  MENS_SHIRT: 'mens_shirt',
  MENS_PANT: 'mens_pant',
  MENS_TSHIRT: 'mens_tshirt',
  MENS_JEANS: 'mens_jeans',
  MENS_SUIT: 'mens_suit',
  
  // Women's
  WOMENS_DRESS: 'womens_dress',
  WOMENS_BLOUSE: 'womens_blouse',
  WOMENS_SAREE: 'womens_saree',
  WOMENS_KURTI: 'womens_kurti',
  WOMENS_JEANS: 'womens_jeans',
  
  // Kids
  KIDS_SHIRT: 'kids_shirt',
  KIDS_DRESS: 'kids_dress',
  KIDS_PANT: 'kids_pant',
  
  // Household
  BEDSHEET: 'bedsheet',
  CURTAIN: 'curtain',
  TOWEL: 'towel',
  PILLOW_COVER: 'pillow_cover'
};

// Ticket Status
const TICKET_STATUS = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
  ESCALATED: 'escalated'
};

// Ticket Priority
const TICKET_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

// Ticket Categories
const TICKET_CATEGORIES = {
  QUALITY: 'quality',
  DELAY: 'delay',
  MISSING_ITEM: 'missing_item',
  DAMAGED: 'damaged',
  PAYMENT: 'payment',
  OTHER: 'other'
};

// Refund Status
const REFUND_STATUS = {
  REQUESTED: 'requested',
  APPROVED: 'approved',
  PROCESSED: 'processed',
  COMPLETED: 'completed',
  REJECTED: 'rejected'
};

// Refund Types
const REFUND_TYPES = {
  FULL: 'full',
  PARTIAL: 'partial',
  STORE_CREDIT: 'store_credit'
};

// Payment Methods
const PAYMENT_METHODS = {
  ONLINE: 'online',
  COD: 'cod'
};

// Staff Roles
const STAFF_ROLES = {
  WASHER: 'washer',
  IRONER: 'ironer'
};

// Inventory Items
const INVENTORY_ITEMS = {
  DETERGENT: 'detergent',
  SOFTENER: 'softener',
  HANGERS: 'hangers',
  PACKAGING: 'packaging',
  CHEMICALS: 'chemicals'
};

// Notification Types
const NOTIFICATION_TYPES = {
  ORDER_PLACED: 'order_placed',
  ORDER_PICKED: 'order_picked',
  ORDER_READY: 'order_ready',
  ORDER_OUT_FOR_DELIVERY: 'order_out_for_delivery',
  ORDER_DELIVERED: 'order_delivered',
  LOW_INVENTORY: 'low_inventory',
  NEW_COMPLAINT: 'new_complaint',
  REFUND_REQUEST: 'refund_request'
};

// Consumption Rates (per service)
const CONSUMPTION_RATES = {
  [SERVICES.WASHING]: {
    [INVENTORY_ITEMS.DETERGENT]: 50 // ml per kg
  },
  [SERVICES.DRY_CLEANING]: {
    [INVENTORY_ITEMS.CHEMICALS]: 100 // ml per item
  },
  [SERVICES.IRONING]: {} // No consumption
};

// Refund Limits (in rupees)
const REFUND_LIMITS = {
  [USER_ROLES.SUPPORT_AGENT]: 0,
  [USER_ROLES.ADMIN]: 500,
  [USER_ROLES.CENTER_ADMIN]: Infinity
};

module.exports = {
  USER_ROLES,
  ORDER_STATUS,
  SERVICES,
  CLOTHING_CATEGORIES,
  ITEM_TYPES,
  TICKET_STATUS,
  TICKET_PRIORITY,
  TICKET_CATEGORIES,
  REFUND_STATUS,
  REFUND_TYPES,
  PAYMENT_METHODS,
  STAFF_ROLES,
  INVENTORY_ITEMS,
  NOTIFICATION_TYPES,
  CONSUMPTION_RATES,
  REFUND_LIMITS
};