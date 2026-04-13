const { exec } = require("child_process");
const path = require("path");
const { aiProcessingQueue } = require("../config/queue");
const { logger } = require("../utils/logger");

function registerMlPipelineJob() {
  aiProcessingQueue.process("run-ml-pipeline", async (job) => {
    return new Promise((resolve, reject) => {
      logger.info("ml_pipeline_start", { jobId: job.id, parkId: job.data.parkId });
      
      const parkId = job.data.parkId || "default_park";
      const pythonExe = path.join(__dirname, "..", "ml", "venv", "Scripts", "python.exe");
      const scriptPath = path.join(__dirname, "..", "ml", "pipeline.py");
      
      exec(`"${pythonExe}" "${scriptPath}" "${parkId}"`, (error, stdout, stderr) => {
        if (error) {
          logger.error("ml_pipeline_error", { error: error.message, stderr });
          return reject(error);
        }
        logger.info("ml_pipeline_done", { stdout });
        resolve({ stdout });
      });
    });
  });

  aiProcessingQueue.add(
    "run-ml-pipeline",
    { parkId: "test_park" },
    {
      jobId: "repeat-ml-pipeline-daily",
      repeat: { cron: "0 0 * * *" },
      removeOnComplete: true,
    },
  );
}

module.exports = { registerMlPipelineJob };
