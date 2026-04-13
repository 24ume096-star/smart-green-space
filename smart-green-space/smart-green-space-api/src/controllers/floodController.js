const { calculateFloodRisk, triggerDrainageResponse } = require("../services/floodMonitoringService");
const { logger } = require("../utils/logger");

async function getFloodRisk(req, res) {
  try {
    const { parkId } = req.params;
    if (!parkId) return res.status(400).json({ error: "parkId is required" });

    const riskData = await calculateFloodRisk(parkId);
    return res.json(riskData);
  } catch (error) {
    logger.error("getFloodRisk_error", { error: error.message, stack: error.stack });
    return res.status(500).json({ error: "Failed to calculate flood risk" });
  }
}

async function triggerFloodResponse(req, res) {
  try {
    const { parkId } = req.params;
    const { riskLevel } = req.body;

    if (!parkId || !['WATCH', 'WARNING', 'EMERGENCY'].includes(riskLevel)) {
        return res.status(400).json({ error: "Invalid parkId or riskLevel" });
    }

    await triggerDrainageResponse(parkId, riskLevel);
    return res.json({ success: true, message: `Response workflow triggered for ${riskLevel}` });
  } catch (error) {
    logger.error("triggerFloodResponse_error", { error: error.message, stack: error.stack });
    return res.status(500).json({ error: "Failed to trigger response" });
  }
}

module.exports = {
  getFloodRisk,
  triggerFloodResponse
};
