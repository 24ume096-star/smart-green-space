const { alertsQueue } = require("../config/queue");
const { logger } = require("../utils/logger");
const { monitorBlockages } = require("../services/floodMonitoringService");

function registerFloodMonitoringJob() {
  alertsQueue.process("monitor-blockages", async (job) => {
    logger.info("flood_monitoring_start", { jobId: job.id });
    await monitorBlockages();
    logger.info("flood_monitoring_done", { jobId: job.id });
    return { ok: true };
  });

  alertsQueue.add(
    "monitor-blockages",
    {},
    {
      jobId: "repeat-monitor-blockages-2m",
      repeat: { cron: "*/2 * * * *" },
      removeOnComplete: true,
    },
  );
}

module.exports = { registerFloodMonitoringJob };
