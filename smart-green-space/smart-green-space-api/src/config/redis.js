const Redis = require("ioredis");
const { env } = require("./env");

let redis;
try {
  redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 0,
    enableReadyCheck: false,
    lazyConnect: true,
    connectTimeout: 1000,
    retryStrategy: () => null, // don't retry, use fallback
  });
} catch (e) {
  // handled by error listener
}

const mockRedis = {
  get: async () => null,
  set: async () => "OK",
  setex: async () => "OK",
  del: async () => 1,
  publish: async () => 0,
  on: () => { },
  status: "mock",
};

redis.on("error", (err) => {
  console.warn("[Redis] Connection failed, using mock fallback.");
  // Patch methods to be mocks to avoid crashes in consumer services
  Object.assign(redis, mockRedis);
});

module.exports = { redis };

