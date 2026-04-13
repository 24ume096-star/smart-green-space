const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const compression = require("compression");

const { env } = require("./config/env");
const { requestLogger } = require("./middleware/requestLogger");
const { globalLimiter } = require("./middleware/rateLimit");
const { notFound } = require("./middleware/notFound");
const { errorHandler } = require("./middleware/errorHandler");
const { routes } = require("./routes");
const satelliteController = require("./controllers/satelliteController");

function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", env.TRUST_PROXY);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(",").map((s) => s.trim()),
      credentials: true,
    }),
  );

  app.post(
    "/api/v1/satellite/webhook/sentinel",
    express.raw({ type: "application/json", limit: "1mb" }),
    satelliteController.webhookSentinel,
  );

  app.use(compression());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  
  const path = require("path");
  app.use("/public", express.static(path.join(__dirname, "..", "public")));

  app.use(requestLogger());
  app.use(globalLimiter);

  app.use("/", routes());

  app.use(notFound());
  app.use(errorHandler());

  return app;
}

module.exports = { createApp };

