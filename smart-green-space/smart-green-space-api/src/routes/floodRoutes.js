const express = require("express");
const { getFloodRisk, triggerFloodResponse } = require("../controllers/floodController");
const { auditLog } = require("../middleware/auditMiddleware");

function floodRoutes() {
  const router = express.Router();

  router.get("/:parkId/risk", getFloodRisk);
  router.post(
    "/:parkId/trigger",
    auditLog("FLOOD_RESPONSE_TRIGGERED"),
    triggerFloodResponse
  );

  return router;
}

module.exports = { floodRoutes };
