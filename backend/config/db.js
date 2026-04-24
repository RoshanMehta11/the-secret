const mongoose = require('mongoose');

// ─── Enhanced MongoDB Connection ──────────────────────────────────
// Configured for production: connection pooling, timeouts,
// read preference for horizontal scaling.

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // Connection pool sizing
      maxPoolSize: 50,        // Up from default 5
      minPoolSize: 10,        // Keep warm connections
      
      // Timeouts
      socketTimeoutMS: 30000,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,

      // Read preference for scaling with replica sets
      // 'secondaryPreferred' reads from secondaries when available
      // Falls back to primary if no secondaries exist (dev/single-node)
      readPreference: process.env.NODE_ENV === 'production'
        ? 'secondaryPreferred'
        : 'primary',
    });

    console.log(`📦 MongoDB Connected: ${conn.connection.host}`);

    // Connection event monitoring
    mongoose.connection.on('error', (err) => {
      console.error('📦 MongoDB connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('📦 MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('📦 MongoDB reconnected');
    });

  } catch (error) {
    console.error(`📦 MongoDB Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
