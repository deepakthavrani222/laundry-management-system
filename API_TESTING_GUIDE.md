# API Testing Guide

This guide provides comprehensive examples for testing all API endpoints in the Laundry Management System.

## 🚀 Getting Started

1. **Start the server**:
   ```bash
   npm run dev
   ```

2. **Base URL**: `http://localhost:5000`

3. **Health Check**:
   ```bash
   curl http://localhost:5000/health
   ```

## 🔐 Authentication Flow

### 1. Register Customer
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "9876543210",
    "password": "password123",
    "role": "customer"
  }'
```

### 2. Register Admin
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin User",
    "email": "admin@example.com",
    "phone": "9876543211",
    "password": "admin123",
    "role": "admin"
  }'
```

### 3. Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

**Save the token from response for subsequent requests!**

## 👤 Customer APIs

### Address Management

#### Add Address
```bash
curl -X POST http://localhost:5000/api/customer/addresses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "John Doe",
    "phone": "9876543210",
    "addressLine1": "123 Main Street",
    "addressLine2": "Apartment 4B",
    "landmark": "Near City Mall",
    "city": "Mumbai",
    "pincode": "400001",
    "addressType": "home",
    "isDefault": true
  }'
```

#### Get Addresses
```bash
curl -X GET http://localhost:5000/api/customer/addresses \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Order Management

#### Create Order
```bash
curl -X POST http://localhost:5000/api/customer/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "items": [
      {
        "itemType": "mens_shirt",
        "service": "washing",
        "category": "normal",
        "quantity": 2,
        "specialInstructions": "Handle with care"
      },
      {
        "itemType": "womens_dress",
        "service": "dry_cleaning",
        "category": "delicate",
        "quantity": 1
      }
    ],
    "pickupAddressId": "ADDRESS_ID_FROM_PREVIOUS_CALL",
    "deliveryAddressId": "ADDRESS_ID_FROM_PREVIOUS_CALL",
    "pickupDate": "2024-01-20",
    "pickupTimeSlot": "09:00-11:00",
    "paymentMethod": "online",
    "isExpress": false,
    "specialInstructions": "Please handle delicate items carefully"
  }'
```

#### Get Orders
```bash
curl -X GET "http://localhost:5000/api/customer/orders?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Get Order by ID
```bash
curl -X GET http://localhost:5000/api/customer/orders/ORDER_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Cancel Order
```bash
curl -X PUT http://localhost:5000/api/customer/orders/ORDER_ID/cancel \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "reason": "Changed my mind"
  }'
```

#### Rate Order
```bash
curl -X PUT http://localhost:5000/api/customer/orders/ORDER_ID/rate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "score": 5,
    "feedback": "Excellent service!"
  }'
```

### Support Tickets

#### Create Ticket
```bash
curl -X POST http://localhost:5000/api/customer/tickets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "title": "Quality Issue with Order",
    "description": "My shirt has a stain that was not removed properly",
    "category": "quality",
    "priority": "high",
    "relatedOrderId": "ORDER_ID"
  }'
```

#### Get Tickets
```bash
curl -X GET http://localhost:5000/api/customer/tickets \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Notifications

#### Get Notifications
```bash
curl -X GET http://localhost:5000/api/customer/notifications \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Get Unread Count
```bash
curl -X GET http://localhost:5000/api/customer/notifications/unread-count \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 👨‍💼 Admin APIs

### Dashboard
```bash
curl -X GET http://localhost:5000/api/admin/dashboard \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Order Management

#### Get All Orders
```bash
curl -X GET "http://localhost:5000/api/admin/orders?page=1&limit=20&status=placed" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

#### Assign Order to Branch
```bash
curl -X PUT http://localhost:5000/api/admin/orders/ORDER_ID/assign-branch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "branchId": "BRANCH_ID"
  }'
```

#### Update Order Status
```bash
curl -X PUT http://localhost:5000/api/admin/orders/ORDER_ID/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "status": "assigned_to_branch",
    "notes": "Assigned to Mumbai branch"
  }'
```

### Customer Management

#### Get Customers
```bash
curl -X GET "http://localhost:5000/api/admin/customers?page=1&limit=20" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

#### Toggle Customer Status
```bash
curl -X PUT http://localhost:5000/api/admin/customers/CUSTOMER_ID/toggle-status \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

#### Tag VIP Customer
```bash
curl -X PUT http://localhost:5000/api/admin/customers/CUSTOMER_ID/vip \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "isVIP": true
  }'
```

## 🏢 Branch Manager APIs

### Dashboard
```bash
curl -X GET http://localhost:5000/api/branch/dashboard \
  -H "Authorization: Bearer BRANCH_MANAGER_TOKEN"
```

### Order Management

#### Get Branch Orders
```bash
curl -X GET http://localhost:5000/api/branch/orders \
  -H "Authorization: Bearer BRANCH_MANAGER_TOKEN"
```

#### Update Order Status
```bash
curl -X PUT http://localhost:5000/api/branch/orders/ORDER_ID/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer BRANCH_MANAGER_TOKEN" \
  -d '{
    "status": "in_process",
    "notes": "Started washing process"
  }'
```

### Staff Management

#### Get Staff
```bash
curl -X GET http://localhost:5000/api/branch/staff \
  -H "Authorization: Bearer BRANCH_MANAGER_TOKEN"
```

#### Create Staff
```bash
curl -X POST http://localhost:5000/api/branch/staff \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer BRANCH_MANAGER_TOKEN" \
  -d '{
    "name": "Raj Kumar",
    "phone": "9876543212",
    "role": "washer"
  }'
```

#### Assign Staff to Order
```bash
curl -X PUT http://localhost:5000/api/branch/orders/ORDER_ID/assign-staff \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer BRANCH_MANAGER_TOKEN" \
  -d '{
    "staffId": "STAFF_ID"
  }'
```

## 🎧 Support Agent APIs

### Dashboard
```bash
curl -X GET http://localhost:5000/api/support/dashboard \
  -H "Authorization: Bearer SUPPORT_TOKEN"
```

### Ticket Management

#### Get Tickets
```bash
curl -X GET http://localhost:5000/api/support/tickets \
  -H "Authorization: Bearer SUPPORT_TOKEN"
```

#### Update Ticket Status
```bash
curl -X PUT http://localhost:5000/api/support/tickets/TICKET_ID/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SUPPORT_TOKEN" \
  -d '{
    "status": "in_progress",
    "priority": "high"
  }'
```

#### Add Message to Ticket
```bash
curl -X POST http://localhost:5000/api/support/tickets/TICKET_ID/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SUPPORT_TOKEN" \
  -d '{
    "message": "We are looking into your issue and will resolve it soon.",
    "isInternal": false
  }'
```

#### Resolve Ticket
```bash
curl -X PUT http://localhost:5000/api/support/tickets/TICKET_ID/resolve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SUPPORT_TOKEN" \
  -d '{
    "resolution": "Issue resolved. Rewash completed and quality checked."
  }'
```

## 👑 Center Admin APIs

### Dashboard
```bash
curl -X GET http://localhost:5000/api/center-admin/dashboard \
  -H "Authorization: Bearer CENTER_ADMIN_TOKEN"
```

### Branch Management

#### Get Branches
```bash
curl -X GET http://localhost:5000/api/center-admin/branches \
  -H "Authorization: Bearer CENTER_ADMIN_TOKEN"
```

#### Create Branch
```bash
curl -X POST http://localhost:5000/api/center-admin/branches \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer CENTER_ADMIN_TOKEN" \
  -d '{
    "name": "Mumbai Central Branch",
    "code": "MUM001",
    "address": {
      "addressLine1": "123 Business District",
      "city": "Mumbai",
      "pincode": "400001"
    },
    "contact": {
      "phone": "9876543213",
      "email": "mumbai@laundry.com"
    },
    "serviceAreas": [
      {
        "pincode": "400001",
        "area": "South Mumbai",
        "deliveryCharge": 50
      }
    ]
  }'
```

### User Management

#### Get Users
```bash
curl -X GET http://localhost:5000/api/center-admin/users \
  -H "Authorization: Bearer CENTER_ADMIN_TOKEN"
```

#### Create User
```bash
curl -X POST http://localhost:5000/api/center-admin/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer CENTER_ADMIN_TOKEN" \
  -d '{
    "name": "Branch Manager",
    "email": "manager@example.com",
    "phone": "9876543214",
    "password": "manager123",
    "role": "branch_manager",
    "assignedBranch": "BRANCH_ID"
  }'
```

## 📊 Testing Workflow

### Complete Order Flow Test

1. **Register Customer & Admin**
2. **Customer adds address**
3. **Customer creates order**
4. **Admin assigns order to branch**
5. **Branch manager updates status to picked**
6. **Branch manager assigns staff**
7. **Branch manager updates to in_process**
8. **Branch manager updates to ready**
9. **Admin assigns logistics for delivery**
10. **Branch manager updates to out_for_delivery**
11. **Branch manager updates to delivered**
12. **Customer rates the order**

### Support Flow Test

1. **Customer creates support ticket**
2. **Support agent picks up ticket**
3. **Support agent adds response**
4. **Support agent resolves ticket**
5. **Customer rates resolution**

## 🔧 Environment Variables

Create `.env` file:
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/laundry_management
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRE=24h
```

## 📝 Response Format

All APIs follow this response format:

**Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Error description"
}
```

## 🚨 Common Error Codes

- `UNAUTHORIZED`: Invalid or missing token
- `FORBIDDEN`: Insufficient permissions
- `VALIDATION_ERROR`: Invalid input data
- `NOT_FOUND`: Resource not found
- `DUPLICATE_FIELD`: Unique constraint violation
- `SERVER_ERROR`: Internal server error

## 📱 Postman Collection

You can import these curl commands into Postman or create a collection with all the endpoints for easier testing.

---

**Note**: Replace `YOUR_TOKEN`, `ORDER_ID`, `BRANCH_ID`, etc. with actual values from your API responses.