const { aiProcessingQueue } = require("../config/queue");
const { logger } = require("../utils/logger");
const { registerSatelliteIngestJob } = require("./satelliteIngestJob");
const { registerAlertAutoResolveJob } = require("./alertAutoResolveJob");
const { registerSimulationJob } = require("./simulationJob");
const { registerFloodMonitoringJob } = require("./floodMonitoringJob");
const { registerMlPipelineJob } = require("./mlPipelineJob");

function registerJobs() {
  aiProcessingQueue.process(async (job) => {
    logger.info("ai_job_received", { id: job.id, name: job.name });
    // Placeholder for model inference / analytics processing pipeline.
    return { ok: true };
  });

  registerSatelliteIngestJob();
  registerAlertAutoResolveJob();
  registerSimulationJob();
  registerFloodMonitoringJob();
  registerMlPipelineJob();
}

module.exports = { registerJobs };

