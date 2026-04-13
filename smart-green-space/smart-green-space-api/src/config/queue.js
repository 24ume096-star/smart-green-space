const Queue = require("bull");
const { env } = require("./env");

const aiProcessingQueue = new Queue("ai-processing", env.REDIS_URL, {
  defaultJobOptions: {
    attempts: 3,
    removeOnComplete: 1000,
    removeOnFail: 5000,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
  },
});

const satelliteIngestQueue = new Queue("satellite-ingest", env.REDIS_URL, {
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: 200,
    removeOnFail: 1000,
    backoff: { type: "fixed", delay: 5000 },
  },
});

const alertsQueue = new Queue("alerts", env.REDIS_URL, {
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: 200,
    removeOnFail: 1000,
    backoff: { type: "fixed", delay: 5000 },
  },
});

const simulationsQueue = new Queue("simulations", env.REDIS_URL, {
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: 200,
    removeOnFail: 1000,
    backoff: { type: "fixed", delay: 5000 },
  },
});

module.exports = { aiProcessingQueue, satelliteIngestQueue, alertsQueue, simulationsQueue };
