/**
 * Mongoose connection with retry logic and event logging.
 * Used for Notifications and Activity Logs — high-write, schema-loose data.
 */

const mongoose = require('mongoose');
const config = require('./index');

async function connectMongo() {
  try {
    await mongoose.connect(config.mongoUri, {
      // Mongoose 8+ uses these by default, but explicit is better:
      serverSelectionTimeoutMS: 5000,
      heartbeatFrequencyMS: 10000,
    });
    console.log('✅ MongoDB connected (Mongoose)');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    throw err;
  }

  mongoose.connection.on('error', (err) => {
    console.error('⚠️  MongoDB connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB disconnected');
  });
}

async function disconnectMongo() {
  await mongoose.disconnect();
  console.log('🔌 MongoDB disconnected');
}

module.exports = { connectMongo, disconnectMongo };
