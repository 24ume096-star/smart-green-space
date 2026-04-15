const express = require("express");
const dashboardController = require("../controllers/dashboardController");

function dashboardRoutes() {
  const router = express.Router();

  router.get("/ndvi", dashboardController.getNdvi);
  router.get("/soil-moisture", dashboardController.getSoilMoisture);
  router.get("/air-quality", dashboardController.getAirQuality);
  router.get("/parks-dashboard", dashboardController.getParks);
  // Per-park GSHI sub-index breakdown (real-data-derived)
  router.get("/sub-indices/:parkId", dashboardController.getSubIndices);

  return router;
}

module.exports = { dashboardRoutes };
