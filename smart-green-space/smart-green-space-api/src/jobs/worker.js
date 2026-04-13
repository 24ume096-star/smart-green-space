const { env } = require("../config/env");
const { logger } = require("../utils/logger");
const { prisma } = require("../config/prisma");
const { redis } = require("../config/redis");
const { registerJobs } = require("./index");

async function bootstrap() {
  registerJobs();

  await Promise.all([
    prisma.$connect(),
    redis.connect().catch((err) => {
      logger.error("redis_connect_failed", { err: err.message });
      throw err;
    }),
  ]);

  logger.info("worker_ready", {
    env: env.NODE_ENV,
  });
}

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.warn("worker_shutdown_initiated", { signal });
  try {
    await prisma.$disconnect();
  } catch (_) {}
  try {
    await redis.quit();
  } catch (_) {}
  logger.info("worker_shutdown_complete");
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

bootstrap().catch((err) => {
  logger.error("worker_startup_failed", { err: err.message, stack: err.stack });
  process.exit(1);
});

