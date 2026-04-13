const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const { validateRequest } = require("../middleware/validate");
const {
  parkIdParamSchema,
  cityIdParamSchema,
  historyQuerySchema,
  ndviTimeseriesQuerySchema,
  manualIngestBodySchema,
} = require("../schemas/satelliteSchemas");
const satelliteController = require("../controllers/satelliteController");

function satelliteRoutes() {
  const router = express.Router();

  router.get(
    "/parks/:parkId/latest",
    validateRequest({ params: parkIdParamSchema }),
    satelliteController.latest,
  );
  router.get(
    "/parks/:parkId/history",
    validateRequest({ params: parkIdParamSchema, query: historyQuerySchema }),
    satelliteController.history,
  );
  router.get(
    "/parks/:parkId/ndvi-timeseries",
    validateRequest({ params: parkIdParamSchema, query: ndviTimeseriesQuerySchema }),
    satelliteController.ndviTimeseries,
  );
  router.post(
    "/parks/:parkId/ingest",
    requireAuth(),
    requireRole("ADMIN"),
    validateRequest({ params: parkIdParamSchema, body: manualIngestBodySchema }),
    satelliteController.ingest,
  );
  router.get(
    "/cities/:cityId/thermal-zones",
    validateRequest({ params: cityIdParamSchema }),
    satelliteController.thermalZones,
  );

  return router;
}

module.exports = { satelliteRoutes };
