const mongoose = require('mongoose');

const connectMongo = async () => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/assetflow';
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

module.exports = connectMongo;
