const { prisma } = require("../config/prisma");
const { redis } = require("../config/redis");

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      const err = new Error("Health dependency timeout");
      err.code = "HEALTH_TIMEOUT";
      setTimeout(() => reject(err), timeoutMs);
    }),
  ]);
}

async function getHealth(req, res, next) {
  try {
    const [dbOk, redisOk] = await Promise.all([
      withTimeout(prisma.$queryRaw`SELECT 1`, 800)
        .then(() => true)
        .catch(() => false),
      withTimeout(redis.ping(), 500)
        .then((v) => v === "PONG")
        .catch(() => false),
    ]);

    res.json({
      status: "ok",
      db: dbOk ? "up" : "down",
      redis: redisOk ? "up" : "down",
      uptime: process.uptime(),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getHealth };

