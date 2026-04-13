const { Server } = require("socket.io");
const { env } = require("../config/env");
const { logger } = require("../utils/logger");
const { setIo, setupSocketLayer } = require("./socketHandler");

function initWebsocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN.split(",").map((s) => s.trim()),
      credentials: true,
    },
  });

  setIo(io);
  setupSocketLayer(io);
  logger.info("socket_layer_ready", { corsOrigins: env.CORS_ORIGIN });

  return io;
}

module.exports = { initWebsocket };

