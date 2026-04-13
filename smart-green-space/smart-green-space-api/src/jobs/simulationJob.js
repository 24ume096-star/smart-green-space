const { simulationsQueue } = require("../config/queue");
const { logger } = require("../utils/logger");
const { finalizeSimulation } = require("../services/simulationService");

function registerSimulationJob() {
  simulationsQueue.process("run", async (job) => {
    const simulationId = job.data?.simulationId;
    if (!simulationId) return { ok: false, error: "missing_simulationId" };
    logger.info("simulation_job_start", { jobId: job.id, simulationId });
    const saved = await finalizeSimulation(simulationId);
    logger.info("simulation_job_done", { jobId: job.id, simulationId, status: saved?.status });
    return { ok: true, simulationId, status: saved?.status };
  });
}

module.exports = { registerSimulationJob };

