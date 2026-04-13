const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const { validateRequest } = require("../middleware/validate");
const {
  parkIdParamSchema,
  cityIdParamSchema,
  pushBodySchema,
  subscribeBodySchema,
  unsubscribeBodySchema,
} = require("../schemas/notificationSchemas");
const notificationsController = require("../controllers/notificationsController");

function notificationsRoutes() {
  const router = express.Router();

  router.post(
    "/push/park/:parkId",
    requireAuth(),
    requireRole("ADMIN", "CITY_OFFICER"),
    validateRequest({ params: parkIdParamSchema, body: pushBodySchema }),
    notificationsController.pushPark,
  );

  router.post(
    "/push/city/:cityId",
    requireAuth(),
    requireRole("ADMIN", "CITY_OFFICER"),
    validateRequest({ params: cityIdParamSchema, body: pushBodySchema }),
    notificationsController.pushCity,
  );

  router.get("/my-notifications", requireAuth(), notificationsController.mine);

  router.post(
    "/subscribe",
    requireAuth(),
    validateRequest({ body: subscribeBodySchema }),
    notificationsController.sub,
  );

  router.post(
    "/unsubscribe",
    requireAuth(),
    validateRequest({ body: unsubscribeBodySchema }),
    notificationsController.unsub,
  );

  return router;
}

module.exports = { notificationsRoutes };

