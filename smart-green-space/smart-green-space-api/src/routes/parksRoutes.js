const express = require("express");
const { validateRequest } = require("../middleware/validate");
const { requireAuth, requireRole } = require("../middleware/auth");
const {
  parkIdParamSchema,
  listParksQuerySchema,
  createParkSchema,
  updateParkSchema,
} = require("../schemas/parksSchemas");
const parksController = require("../controllers/parksController");

/**
 * @openapi
 * /api/v1/parks:
 *   get:
 *     summary: List parks with filters and pagination
 *     tags: [Parks]
 *     parameters:
 *       - in: query
 *         name: cityId
 *         schema: { type: string }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [URBAN_PARK, FOREST, GARDEN, WETLAND] }
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200: { description: Paginated parks }
 *       422: { description: Validation error }
 *   post:
 *     summary: Create a park
 *     tags: [Parks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cityId, name, area, lat, lng, type]
 *             properties:
 *               cityId: { type: string }
 *               name: { type: string }
 *               area: { type: number }
 *               lat: { type: number }
 *               lng: { type: number }
 *               geoJsonBoundary: { type: object }
 *               type: { type: string, enum: [URBAN_PARK, FOREST, GARDEN, WETLAND] }
 *     responses:
 *       201: { description: Park created }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *
 * /api/v1/parks/{parkId}:
 *   get:
 *     summary: Get park detail with latest metrics
 *     tags: [Parks]
 *     parameters:
 *       - in: path
 *         name: parkId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Park detail }
 *       404: { description: Not found }
 *   put:
 *     summary: Update park details
 *     tags: [Parks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: parkId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cityId: { type: string }
 *               name: { type: string }
 *               area: { type: number }
 *               lat: { type: number }
 *               lng: { type: number }
 *               geoJsonBoundary: { type: object }
 *               type: { type: string, enum: [URBAN_PARK, FOREST, GARDEN, WETLAND] }
 *               isActive: { type: boolean }
 *     responses:
 *       200: { description: Park updated }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Not found }
 *
 * /api/v1/parks/{parkId}/zones:
 *   get:
 *     summary: List irrigation zones by park
 *     tags: [Parks]
 *     parameters:
 *       - in: path
 *         name: parkId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Zones list }
 *       404: { description: Park not found }
 *
 * /api/v1/parks/{parkId}/stats/summary:
 *   get:
 *     summary: Get park summary statistics
 *     tags: [Parks]
 *     parameters:
 *       - in: path
 *         name: parkId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Summary statistics }
 *       404: { description: Park not found }
 */
function parksRoutes() {
  const router = express.Router();

  router.get("/", validateRequest({ query: listParksQuerySchema }), parksController.list);
  router.get(
    "/:parkId",
    validateRequest({ params: parkIdParamSchema }),
    parksController.detail,
  );
  router.post(
    "/",
    requireAuth(),
    requireRole("ADMIN", "CITY_OFFICER"),
    validateRequest({ body: createParkSchema }),
    parksController.create,
  );
  router.put(
    "/:parkId",
    requireAuth(),
    requireRole("ADMIN", "CITY_OFFICER"),
    validateRequest({ params: parkIdParamSchema, body: updateParkSchema }),
    parksController.update,
  );
  router.get(
    "/:parkId/zones",
    validateRequest({ params: parkIdParamSchema }),
    parksController.zones,
  );
  router.get(
    "/:parkId/stats/summary",
    validateRequest({ params: parkIdParamSchema }),
    parksController.statsSummary,
  );

  return router;
}

module.exports = { parksRoutes };
