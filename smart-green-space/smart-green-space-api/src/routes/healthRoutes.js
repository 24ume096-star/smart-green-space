const express = require("express");
const { getHealth } = require("../controllers/healthController");

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check
 *     responses:
 *       200:
 *         description: Service health
 */
function healthRoutes() {
  const router = express.Router();
  router.get("/", getHealth);
  return router;
}

module.exports = { healthRoutes };

