const { alertsQueue } = require("../config/queue");
const { logger } = require("../utils/logger");
const { autoResolveCheck } = require("../services/alertService");

function registerAlertAutoResolveJob() {
  alertsQueue.process("auto-resolve", async (job) => {
    logger.info("alerts_auto_resolve_start", { jobId: job.id });
    const summary = await autoResolveCheck();
    logger.info("alerts_auto_resolve_done", { jobId: job.id, summary });
    return summary;
  });

  alertsQueue.add(
    "auto-resolve",
    {},
    {
      jobId: "repeat-alerts-auto-resolve-5m",
      repeat: { cron: "*/5 * * * *" },
      removeOnComplete: true,
    },
  );
}

module.exports = { registerAlertAutoResolveJob };

