const { satelliteIngestQueue } = require("../config/queue");
const { logger } = require("../utils/logger");
const {
  runScheduledIngest,
  processNdviImage,
  generateMockNdviData,
} = require("../services/satelliteService");

function registerSatelliteIngestJob() {
  satelliteIngestQueue.process("scheduled-ingest", async (job) => {
    logger.info("satellite_scheduled_ingest_start", { jobId: job.id });
    const summary = await runScheduledIngest();
    logger.info("satellite_scheduled_ingest_done", { jobId: job.id, summary });
    return summary;
  });

  satelliteIngestQueue.process("sentinel-webhook", async (job) => {
    const payload = job.data?.payload || {};
    const parkId = payload.parkId;
    logger.info("satellite_sentinel_webhook_job", { jobId: job.id, parkId });
    if (!parkId) {
      return { ok: true, skipped: true, reason: "missing_parkId" };
    }
    const mock = generateMockNdviData(parkId);
    const source =
      payload.source === "LANDSAT" || payload.source === "SENTINEL2" ? payload.source : "SENTINEL2";
    await processNdviImage(parkId, mock.pixels, {
      capturedAt: payload.capturedAt ? new Date(payload.capturedAt) : mock.capturedAt,
      source,
      thermalMeanC: typeof payload.thermalMeanC === "number" ? payload.thermalMeanC : mock.thermalMeanC,
      cloudCoverage: payload.cloudCoverage,
    });
    return { ok: true, parkId };
  });

  satelliteIngestQueue.add(
    "scheduled-ingest",
    {},
    {
      jobId: "repeat-satellite-ingest-6h",
      repeat: { cron: "0 */6 * * *" },
      removeOnComplete: true,
    },
  );
}

module.exports = { registerSatelliteIngestJob };
