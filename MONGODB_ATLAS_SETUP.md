# MongoDB Atlas Cluster Setup Guide

## Prerequisites
- MongoDB Atlas account (free at https://www.mongodb.com/atlas)
- Project created in MongoDB Atlas

## Step 1: Create a Cluster

1. **Login to MongoDB Atlas**
   - Go to https://cloud.mongodb.com/
   - Sign in to your account

2. **Create a New Cluster**
   - Click "Build a Database"
   - Choose "Shared" (Free tier) or "Dedicated" (Paid)
   - Select your preferred cloud provider and region
   - Choose cluster tier (M0 for free)
   - Name your cluster (e.g., "laundry-management-cluster")
   - Click "Create Cluster"

## Step 2: Configure Database Access

1. **Create Database User**
   - Go to "Database Access" in the left sidebar
   - Click "Add New Database User"
   - Choose "Password" authentication
   - Enter username and password (save these!)
   - Set privileges to "Read and write to any database"
   - Click "Add User"

2. **Configure Network Access**
   - Go to "Network Access" in the left sidebar
   - Click "Add IP Address"
   - For development: Click "Allow Access from Anywhere" (0.0.0.0/0)
   - For production: Add your specific IP addresses
   - Click "Confirm"

## Step 3: Get Connection String

1. **Get Connection String**
   - Go to "Clusters" in the left sidebar
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Select "Node.js" and version "4.1 or later"
   - Copy the connection string

2. **Connection String Format**
   ```
   mongodb+srv://<username>:<password>@<cluster-name>.mongodb.net/<database-name>?retryWrites=true&w=majority
   ```

## Step 4: Update Environment Variables

1. **Update your `.env` file**
   ```env
   MONGODB_URI=mongodb+srv://your-username:your-password@your-cluster.mongodb.net/laundry_management?retryWrites=true&w=majority
   ```

2. **Replace placeholders:**
   - `your-username` → Your database username
   - `your-password` → Your database password
   - `your-cluster` → Your cluster name
   - `laundry_management` → Your database name

## Example Configuration

```env
# Example .env configuration
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb+srv://laundry_admin:SecurePass123@laundry-cluster.abc123.mongodb.net/laundry_management?retryWrites=true&w=majority
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRE=24h
```

## Step 5: Test Connection

1. **Start your application**
   ```bash
   npm start
   ```

2. **Check console output**
   - Look for: `✅ MongoDB Connected: laundry-cluster-shard-00-02.abc123.mongodb.net`
   - Database name: `📊 Database: laundry_management`

## Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Check username and password in connection string
   - Ensure user has proper database permissions

2. **Network Timeout**
   - Check Network Access settings in Atlas
   - Ensure your IP is whitelisted

3. **Connection String Format**
   - Ensure you're using `mongodb+srv://` (not `mongodb://`)
   - Check for special characters in password (URL encode if needed)

4. **Database Name**
   - Database will be created automatically when first document is inserted
   - No need to create database manually in Atlas

### URL Encoding for Special Characters

If your password contains special characters, URL encode them:
- `@` → `%40`
- `:` → `%3A`
- `/` → `%2F`
- `?` → `%3F`
- `#` → `%23`
- `[` → `%5B`
- `]` → `%5D`

Example:
```
Password: myP@ss:word
Encoded: myP%40ss%3Aword
```

## Security Best Practices

1. **Environment Variables**
   - Never commit `.env` file to version control
   - Use different credentials for development/production

2. **Network Access**
   - Restrict IP access in production
   - Use VPC peering for enhanced security

3. **Database Users**
   - Create separate users for different environments
   - Use principle of least privilege

4. **Connection Monitoring**
   - Monitor connection metrics in Atlas dashboard
   - Set up alerts for connection issues

## Atlas Dashboard Features

- **Real-time Performance Metrics**
- **Query Performance Insights**
- **Automated Backups**
- **Data Explorer**
- **Schema Analysis**

Your MongoDB Atlas cluster is now ready for use with the laundry management system!