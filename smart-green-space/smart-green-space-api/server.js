const http = require("http");

const { createApp } = require("./src/app");
const { env } = require("./src/config/env");
const { logger } = require("./src/utils/logger");
const { prisma } = require("./src/config/prisma");
const { redis } = require("./src/config/redis");
const { initWebsocket } = require("./src/websocket");
const { aiProcessingQueue } = require("./src/config/queue");
const { registerJobs } = require("./src/jobs");

const app = createApp();
const server = http.createServer(app);
const io = initWebsocket(server);

async function bootstrap() {
  registerJobs();

  await Promise.all([
    prisma.$connect(),
    redis.connect().catch((err) => {
      logger.error("redis_connect_failed", { err: err.message });
    }),
  ]);

  server.listen(env.PORT, () => {
    logger.info("server_listening", {
      port: env.PORT,
      env: env.NODE_ENV,
      corsOrigin: env.CORS_ORIGIN,
    });
  });
}

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.warn("shutdown_initiated", { signal });

  // Stop accepting new connections
  server.close(async (err) => {
    if (err) {
      logger.error("server_close_error", { err: err.message });
    }
  });

  try {
    io?.close();
  } catch (e) {
    logger.error("socketio_close_error", { err: e?.message });
  }

  // Close DB + Redis
  try {
    await prisma.$disconnect();
  } catch (e) {
    logger.error("prisma_disconnect_error", { err: e?.message });
  }

  try {
    await redis.quit();
  } catch (e) {
    logger.error("redis_quit_error", { err: e?.message });
  }

  try {
    await aiProcessingQueue.close();
  } catch (e) {
    logger.error("queue_close_error", { err: e?.message });
  }

  logger.info("shutdown_complete");
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  logger.error("unhandled_rejection", { reason: String(reason) });
});

process.on("uncaughtException", (err) => {
  logger.error("uncaught_exception", { err: err.message, stack: err.stack });
  shutdown("uncaughtException");
});

bootstrap().catch((err) => {
  logger.error("startup_failed", { err: err.message, stack: err.stack });
  process.exit(1);
});

