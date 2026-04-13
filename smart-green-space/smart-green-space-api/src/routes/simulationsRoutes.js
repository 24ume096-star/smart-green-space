const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const { validateRequest } = require("../middleware/validate");
const {
  parkIdParamSchema,
  simulationIdParamSchema,
  runSimulationBodySchema,
} = require("../schemas/simulationSchemas");
const simulationsController = require("../controllers/simulationsController");

/**
 * @openapi
 * /api/v1/simulations/parks/{parkId}/run:
 *   post:
 *     summary: Run digital twin simulation (async)
 *     tags: [DigitalTwin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: parkId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       202: { description: Simulation queued }
 *
 * /api/v1/simulations/{simulationId}:
 *   get:
 *     summary: Get simulation status and results
 *     tags: [DigitalTwin]
 *     security:
 *       - bearerAuth: []
 *
 * /api/v1/simulations/parks/{parkId}/history:
 *   get:
 *     summary: Get simulation history for a park
 *     tags: [DigitalTwin]
 *     security:
 *       - bearerAuth: []
 */
function simulationsRoutes() {
  const router = express.Router();

  router.post(
    "/parks/:parkId/run",
    requireAuth(),
    requireRole("ADMIN", "CITY_OFFICER"),
    validateRequest({ params: parkIdParamSchema, body: runSimulationBodySchema }),
    simulationsController.run,
  );
  router.get(
    "/:simulationId",
    requireAuth(),
    requireRole("ADMIN", "CITY_OFFICER", "RESEARCHER"),
    validateRequest({ params: simulationIdParamSchema }),
    simulationsController.detail,
  );
  router.get(
    "/parks/:parkId/history",
    requireAuth(),
    requireRole("ADMIN", "CITY_OFFICER", "RESEARCHER"),
    validateRequest({ params: parkIdParamSchema }),
    simulationsController.history,
  );

  return router;
}

module.exports = { simulationsRoutes };

