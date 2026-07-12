require('dotenv').config({ path: '../.env' });
const app = require('./src/app');
const connectMongo = require('./src/config/mongo');
const { connectRedis } = require('./src/config/redis');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Connect to MongoDB
    await connectMongo();
    
    // Connect to Redis
    await connectRedis();

    // Start Express server
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
