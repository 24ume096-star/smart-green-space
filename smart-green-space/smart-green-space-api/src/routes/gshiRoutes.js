const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const { validateRequest } = require("../middleware/validate");
const {
  parkIdParamSchema,
  cityIdParamSchema,
  historyQuerySchema,
  calculateBodySchema,
} = require("../schemas/gshiSchemas");
const gshiController = require("../controllers/gshiController");
const { geoLimiter } = require("../middleware/rateLimit");
const { auditLog } = require("../middleware/auditMiddleware");

/**
 * @openapi
 * /api/v1/gshi/parks/{parkId}/current:
 *   get:
 *     summary: Get latest GSHI score for a park
 *     tags: [GSHI]
 *     parameters:
 *       - in: path
 *         name: parkId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Latest GSHI score }
 *       404: { description: Not found }
 *
 * /api/v1/gshi/parks/{parkId}/history:
 *   get:
 *     summary: Get historical GSHI trend
 *     tags: [GSHI]
 *     parameters:
 *       - in: path
 *         name: parkId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: from
 *         required: true
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         required: true
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: interval
 *         schema: { type: string, enum: [daily, weekly, monthly] }
 *     responses:
 *       200: { description: GSHI time series }
 *
 * /api/v1/gshi/parks/{parkId}/calculate:
 *   post:
 *     summary: Trigger GSHI recalculation
 *     tags: [GSHI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: parkId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               infrastructureScore:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *     responses:
 *       200: { description: Recalculated GSHI }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *
 * /api/v1/gshi/cities/{cityId}/rankings:
 *   get:
 *     summary: Get city parks ranked by GSHI
 *     tags: [GSHI]
 *     parameters:
 *       - in: path
 *         name: cityId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Ranked parks }
 *
 * /api/v1/gshi/parks/{parkId}/forecast:
 *   get:
 *     summary: Forecast GSHI for next 7 days
 *     tags: [GSHI]
 *     parameters:
 *       - in: path
 *         name: parkId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Forecast points }
 *
 * /api/v1/gshi/cities/{cityId}/average:
 *   get:
 *     summary: Get city-wide GSHI average and trend
 *     tags: [GSHI]
 *     parameters:
 *       - in: path
 *         name: cityId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: City average GSHI }
 */
function gshiRoutes() {
  const router = express.Router();

  router.get(
    "/parks/:parkId/current",
    validateRequest({ params: parkIdParamSchema }),
    gshiController.current,
  );
  router.get(
    "/parks/:parkId/history",
    validateRequest({ params: parkIdParamSchema, query: historyQuerySchema }),
    gshiController.history,
  );
  router.post(
    "/parks/:parkId/calculate",
    requireAuth(),
    requireRole("ADMIN", "CITY_OFFICER"),
    geoLimiter,
    auditLog("GSHI_RECALCULATION_TRIGGERED"),
    validateRequest({ params: parkIdParamSchema, body: calculateBodySchema }),
    gshiController.calculate,
  );
  router.get(
    "/cities/:cityId/rankings",
    validateRequest({ params: cityIdParamSchema }),
    gshiController.rankings,
  );
  router.get(
    "/parks/:parkId/forecast",
    validateRequest({ params: parkIdParamSchema }),
    gshiController.forecast,
  );
  router.get(
    "/cities/:cityId/average",
    validateRequest({ params: cityIdParamSchema }),
    gshiController.cityAverage,
  );

  return router;
}

module.exports = { gshiRoutes };
