/**
 * Redis clients for cache + pub/sub.
 * Two separate clients because ioredis enters subscriber mode on subscribe(),
 * making the client unusable for regular commands.
 */

const Redis = require('ioredis');
const config = require('./index');

let redisClient;
let redisPub;
let redisSub;

function createClient(label) {
  const client = new Redis(config.redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 200, 2000);
      return delay;
    },
    lazyConnect: true,
  });

  client.on('connect', () => console.log(`✅ Redis ${label} connected`));
  client.on('error', (err) => console.error(`⚠️  Redis ${label} error:`, err.message));

  return client;
}

async function connectRedis() {
  redisClient = createClient('cache');
  redisPub = createClient('pub');
  redisSub = createClient('sub');

  try {
    await Promise.all([
      redisClient.connect(),
      redisPub.connect(),
      redisSub.connect(),
    ]);
  } catch (err) {
    console.error('❌ Redis connection failed:', err.message);
    throw err;
  }
}

async function disconnectRedis() {
  await Promise.all([
    redisClient?.quit(),
    redisPub?.quit(),
    redisSub?.quit(),
  ]);
  console.log('🔌 Redis disconnected');
}

/**
 * Get the main cache client.
 */
function getRedisClient() {
  return redisClient;
}

/**
 * Get the publish client (for real-time notification push).
 */
function getRedisPub() {
  return redisPub;
}

/**
 * Get the subscribe client.
 */
function getRedisSub() {
  return redisSub;
}

module.exports = {
  connectRedis,
  disconnectRedis,
  getRedisClient,
  getRedisPub,
  getRedisSub,
};
