const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const { validateRequest } = require("../middleware/validate");
const {
  listAlertsQuerySchema,
  alertIdParamSchema,
  createAlertBodySchema,
  assignBodySchema,
  resolveBodySchema,
  escalateBodySchema,
  cityIdParamSchema,
} = require("../schemas/alertSchemas");
const alertsController = require("../controllers/alertsController");

/**
 * @openapi
 * /api/v1/alerts:
 *   get:
 *     summary: List alerts (paginated)
 *     tags: [Alerts]
 *     parameters:
 *       - in: query
 *         name: parkId
 *         schema: { type: string }
 *       - in: query
 *         name: cityId
 *         schema: { type: string }
 *       - in: query
 *         name: severity
 *         schema: { type: string, enum: [CRITICAL, WARNING, INFO] }
 *       - in: query
 *         name: type
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [OPEN, ASSIGNED, RESOLVED, ESCALATED] }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100 }
 *     responses:
 *       200: { description: Paginated alert list }
 *   post:
 *     summary: Create a manual alert
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201: { description: Alert created }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *
 * /api/v1/alerts/{alertId}:
 *   get:
 *     summary: Alert detail with action logs
 *     tags: [Alerts]
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Alert detail }
 *       404: { description: Not found }
 *
 * /api/v1/alerts/{alertId}/assign:
 *   patch:
 *     summary: Assign alert to a user
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *
 * /api/v1/alerts/{alertId}/resolve:
 *   patch:
 *     summary: Resolve alert
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *
 * /api/v1/alerts/{alertId}/escalate:
 *   patch:
 *     summary: Escalate alert
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *
 * /api/v1/alerts/cities/{cityId}/summary:
 *   get:
 *     summary: City alerts summary KPI
 *     tags: [Alerts]
 */
function alertsRoutes() {
  const router = express.Router();

  router.get("/", validateRequest({ query: listAlertsQuerySchema }), alertsController.list);
  router.get(
    "/:alertId",
    validateRequest({ params: alertIdParamSchema }),
    alertsController.detail,
  );
  router.post(
    "/",
    requireAuth(),
    requireRole("ADMIN", "CITY_OFFICER"),
    validateRequest({ body: createAlertBodySchema }),
    alertsController.create,
  );
  router.patch(
    "/:alertId/assign",
    requireAuth(),
    requireRole("ADMIN", "CITY_OFFICER"),
    validateRequest({ params: alertIdParamSchema, body: assignBodySchema }),
    alertsController.assign,
  );
  router.patch(
    "/:alertId/resolve",
    requireAuth(),
    requireRole("ADMIN", "CITY_OFFICER"),
    validateRequest({ params: alertIdParamSchema, body: resolveBodySchema }),
    alertsController.resolve,
  );
  router.patch(
    "/:alertId/escalate",
    requireAuth(),
    requireRole("ADMIN", "CITY_OFFICER"),
    validateRequest({ params: alertIdParamSchema, body: escalateBodySchema }),
    alertsController.escalate,
  );
  router.get(
    "/cities/:cityId/summary",
    validateRequest({ params: cityIdParamSchema }),
    alertsController.citySummary,
  );

  return router;
}

module.exports = { alertsRoutes };

