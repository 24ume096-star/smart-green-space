const express = require("express");
const swaggerUi = require("swagger-ui-express");

const { buildOpenApiSpec, swaggerEnabled } = require("../config/swagger");
const { healthRoutes } = require("./healthRoutes");
const { authRoutes } = require("./authRoutes");
const { parksRoutes } = require("./parksRoutes");
const { sensorsRoutes } = require("./sensorsRoutes");
const { gshiRoutes } = require("./gshiRoutes");
const { satelliteRoutes } = require("./satelliteRoutes");
const { alertsRoutes } = require("./alertsRoutes");
const { simulationsRoutes } = require("./simulationsRoutes");
const { analyticsRoutes } = require("./analyticsRoutes");
const { citizenReportsRoutes } = require("./citizenReportsRoutes");
const { notificationsRoutes } = require("./notificationsRoutes");
const { floodRoutes } = require("./floodRoutes");
const { aiRoutes }    = require("./aiRoutes");

function routes() {
  const router = express.Router();

  router.use("/health", healthRoutes());
  router.use("/api/v1/auth", authRoutes());
  router.use("/api/v1/parks", parksRoutes());
  router.use("/api/v1/sensors", sensorsRoutes());
  router.use("/api/v1/gshi", gshiRoutes());
  router.use("/api/v1/satellite", satelliteRoutes());
  router.use("/api/v1/alerts", alertsRoutes());
  router.use("/api/v1/simulations", simulationsRoutes());
  router.use("/api/v1/analytics", analyticsRoutes());
  router.use("/api/v1/citizen-reports", citizenReportsRoutes());
  router.use("/api/v1/notifications", notificationsRoutes());
  router.use("/api/v1/flood", floodRoutes());
  router.use("/api/v1/ai",    aiRoutes());

  if (swaggerEnabled) {
    const spec = buildOpenApiSpec();
    router.use("/docs", swaggerUi.serve, swaggerUi.setup(spec));
  }

  return router;
}

module.exports = { routes };

