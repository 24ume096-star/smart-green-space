const express = require("express");
const { chat, models } = require("../controllers/aiController");
const { aiLimiter } = require("../middleware/rateLimit");
const { auditLog } = require("../middleware/auditMiddleware");

function aiRoutes() {
  const router = express.Router();

  // POST /api/v1/ai/chat  — main chat endpoint
  router.post(
    "/chat",
    aiLimiter,
    auditLog("AI_CHAT_REQUEST"),
    chat
  );

  // GET  /api/v1/ai/models — available model list
  router.get("/models", models);

  return router;
}

module.exports = { aiRoutes };
