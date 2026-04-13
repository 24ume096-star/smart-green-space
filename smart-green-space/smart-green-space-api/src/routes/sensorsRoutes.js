const express = require("express");
const { validateRequest } = require("../middleware/validate");
const { requireAuth, requireRole } = require("../middleware/auth");
const {
  nodeIdParamSchema,
  listSensorsQuerySchema,
  createSensorSchema,
  updateSensorSchema,
  readingBodySchema,
  readingsQuerySchema,
} = require("../schemas/sensorSchemas");
const sensorsController = require("../controllers/sensorsController");

/**
 * @openapi
 * /api/v1/sensors:
 *   get:
 *     summary: List sensor nodes with latest reading
 *     tags: [Sensors]
 *     parameters:
 *       - in: query
 *         name: parkId
 *         schema: { type: string }
 *       - in: query
 *         name: zoneId
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ONLINE, OFFLINE, ALERT, MAINTENANCE] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100 }
 *     responses:
 *       200: { description: Paginated sensor nodes }
 *   post:
 *     summary: Create a sensor node
 *     tags: [Sensors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [parkId, zoneId, nodeCode, lat, lng]
 *             properties:
 *               parkId: { type: string }
 *               zoneId: { type: string }
 *               nodeCode: { type: string }
 *               lat: { type: number }
 *               lng: { type: number }
 *               model: { type: string }
 *               firmwareVersion: { type: string }
 *     responses:
 *       201: { description: Sensor node created }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *
 * /api/v1/sensors/{nodeId}:
 *   get:
 *     summary: Get sensor node detail with last 60 readings
 *     tags: [Sensors]
 *     parameters:
 *       - in: path
 *         name: nodeId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Sensor node detail }
 *       404: { description: Not found }
 *   put:
 *     summary: Update sensor node config or status
 *     tags: [Sensors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: nodeId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Sensor node updated }
 *       401: { description: Unauthorized }
 *       404: { description: Not found }
 *   delete:
 *     summary: Soft delete a sensor node
 *     tags: [Sensors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: nodeId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Sensor node deactivated }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Not found }
 *
 * /api/v1/sensors/{nodeId}/readings:
 *   post:
 *     summary: Ingest sensor reading with anomaly detection
 *     tags: [Sensors]
 *     parameters:
 *       - in: path
 *         name: nodeId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               soilMoisture: { type: number }
 *               temperature: { type: number }
 *               humidity: { type: number }
 *               airQualityPM25: { type: number }
 *               airQualityPM10: { type: number }
 *               co2Level: { type: number }
 *               lightIntensity: { type: number }
 *               windSpeed: { type: number }
 *     responses:
 *       201: { description: Reading ingested }
 *       404: { description: Node not found }
 *       422: { description: Validation error }
 *   get:
 *     summary: Get aggregated readings by time bucket
 *     tags: [Sensors]
 *     parameters:
 *       - in: path
 *         name: nodeId
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
 *         schema: { type: string, enum: [1min, 5min, 1hour, 1day] }
 *     responses:
 *       200: { description: Aggregated readings }
 *
 * /api/v1/sensors/{nodeId}/readings/latest:
 *   get:
 *     summary: Get latest sensor reading
 *     tags: [Sensors]
 *     parameters:
 *       - in: path
 *         name: nodeId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Latest reading }
 */
function sensorsRoutes() {
  const router = express.Router();

  router.get("/", validateRequest({ query: listSensorsQuerySchema }), sensorsController.list);
  router.get(
    "/:nodeId",
    validateRequest({ params: nodeIdParamSchema }),
    sensorsController.detail,
  );
  router.post(
    "/",
    requireAuth(),
    requireRole("ADMIN"),
    validateRequest({ body: createSensorSchema }),
    sensorsController.create,
  );
  router.put(
    "/:nodeId",
    requireAuth(),
    validateRequest({ params: nodeIdParamSchema, body: updateSensorSchema }),
    sensorsController.update,
  );
  router.post(
    "/:nodeId/readings",
    validateRequest({ params: nodeIdParamSchema, body: readingBodySchema }),
    sensorsController.createReading,
  );
  router.get(
    "/:nodeId/readings",
    validateRequest({ params: nodeIdParamSchema, query: readingsQuerySchema }),
    sensorsController.readings,
  );
  router.get(
    "/:nodeId/readings/latest",
    validateRequest({ params: nodeIdParamSchema }),
    sensorsController.latestReading,
  );
  router.delete(
    "/:nodeId",
    requireAuth(),
    requireRole("ADMIN"),
    validateRequest({ params: nodeIdParamSchema }),
    sensorsController.remove,
  );

  return router;
}

module.exports = { sensorsRoutes };
