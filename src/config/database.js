const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    
    // More detailed error logging for cluster connections
    if (error.name === 'MongoServerSelectionError') {
      console.error('💡 Check your MongoDB Atlas cluster connection string and network access');
    }
    if (error.name === 'MongoParseError') {
      console.error('💡 Check your MongoDB connection string format');
    }
    
    process.exit(1);
  }
};

module.exports = connectDB;