const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const { validateRequest } = require("../middleware/validate");
const {
  parkIdParamSchema,
  cityIdParamSchema,
  gshiTrendQuerySchema,
  alertsAnalyticsQuerySchema,
} = require("../schemas/analyticsSchemas");
const analyticsController = require("../controllers/analyticsController");

/**
 * @openapi
 * /api/v1/analytics/parks/{parkId}/overview:
 *   get:
 *     summary: Park overview dashboard stats
 *     tags: [Analytics]
 *     parameters:
 *       - in: path
 *         name: parkId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Overview stats }
 *
 * /api/v1/analytics/parks/{parkId}/gshi-trend:
 *   get:
 *     summary: GSHI trend for charts
 *     tags: [Analytics]
 *
 * /api/v1/analytics/cities/{cityId}/park-rankings:
 *   get:
 *     summary: City park rankings by GSHI
 *     tags: [Analytics]
 *
 * /api/v1/analytics/parks/{parkId}/alert-analytics:
 *   get:
 *     summary: Alert analytics for charts
 *     tags: [Analytics]
 *
 * /api/v1/analytics/parks/{parkId}/ai-forecast:
 *   get:
 *     summary: 7-day AI-ish forecast (heuristic)
 *     tags: [Analytics]
 *
 * /api/v1/analytics/cities/{cityId}/dashboard-summary:
 *   get:
 *     summary: City-level dashboard summary
 *     tags: [Analytics]
 */
function analyticsRoutes() {
  const router = express.Router();

  router.get(
    "/parks/:parkId/overview",
    requireAuth(),
    requireRole("ADMIN", "CITY_OFFICER", "RESEARCHER"),
    validateRequest({ params: parkIdParamSchema }),
    analyticsController.parkOverview,
  );
  router.get(
    "/parks/:parkId/carbon",
    requireAuth(),
    requireRole("ADMIN", "CITY_OFFICER", "RESEARCHER"),
    validateRequest({ params: parkIdParamSchema }),
    analyticsController.parkCarbonStats,
  );
  router.get(
    "/parks/:parkId/gshi-trend",
    requireAuth(),
    requireRole("ADMIN", "CITY_OFFICER", "RESEARCHER"),
    validateRequest({ params: parkIdParamSchema, query: gshiTrendQuerySchema }),
    analyticsController.parkGshiTrend,
  );
  router.get(
    "/cities/:cityId/park-rankings",
    requireAuth(),
    requireRole("ADMIN", "CITY_OFFICER", "RESEARCHER"),
    validateRequest({ params: cityIdParamSchema }),
    analyticsController.cityParkRankings,
  );
  router.get(
    "/parks/:parkId/alert-analytics",
    requireAuth(),
    requireRole("ADMIN", "CITY_OFFICER", "RESEARCHER"),
    validateRequest({ params: parkIdParamSchema, query: alertsAnalyticsQuerySchema }),
    analyticsController.parkAlertAnalytics,
  );
  router.get(
    "/parks/:parkId/ai-forecast",
    requireAuth(),
    requireRole("ADMIN", "CITY_OFFICER", "RESEARCHER"),
    validateRequest({ params: parkIdParamSchema }),
    analyticsController.parkAiForecast,
  );
  router.get(
    "/cities/:cityId/dashboard-summary",
    requireAuth(),
    requireRole("ADMIN", "CITY_OFFICER", "RESEARCHER"),
    validateRequest({ params: cityIdParamSchema }),
    analyticsController.cityDashboardSummary,
  );

  return router;
}

module.exports = { analyticsRoutes };

