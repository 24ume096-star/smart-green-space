const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const { optionalAuth } = require("../middleware/optionalAuth");
const { upload } = require("../middleware/upload");
const { validateRequest } = require("../middleware/validate");
const {
  listQuerySchema,
  createBodySchema,
  reportIdParamSchema,
  parkIdParamSchema,
  verifyBodySchema,
  leaderboardQuerySchema,
} = require("../schemas/citizenReportSchemas");
const citizenReportsController = require("../controllers/citizenReportsController");

function citizenReportsRoutes() {
  const router = express.Router();

  router.get(
    "/",
    requireAuth(),
    // CITIZEN can only see own reports (enforced in service)
    requireRole("ADMIN", "CITY_OFFICER", "RESEARCHER", "CITIZEN"),
    validateRequest({ query: listQuerySchema }),
    citizenReportsController.list,
  );

  router.post(
    "/",
    optionalAuth(),
    upload.single("photo"),
    validateRequest({ body: createBodySchema }),
    citizenReportsController.create,
  );

  router.patch(
    "/:reportId/verify",
    requireAuth(),
    requireRole("ADMIN", "CITY_OFFICER"),
    validateRequest({ params: reportIdParamSchema, body: verifyBodySchema }),
    citizenReportsController.verify,
  );

  router.patch(
    "/:reportId/action",
    requireAuth(),
    requireRole("ADMIN", "CITY_OFFICER"),
    validateRequest({ params: reportIdParamSchema }),
    citizenReportsController.action,
  );

  router.get(
    "/parks/:parkId/stats",
    requireAuth(),
    requireRole("ADMIN", "CITY_OFFICER", "RESEARCHER"),
    validateRequest({ params: parkIdParamSchema }),
    citizenReportsController.stats,
  );

  router.get(
    "/leaderboard",
    validateRequest({ query: leaderboardQuerySchema }),
    citizenReportsController.top,
  );

  return router;
}

module.exports = { citizenReportsRoutes };

