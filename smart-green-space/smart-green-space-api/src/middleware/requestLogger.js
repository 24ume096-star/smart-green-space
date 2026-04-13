const morgan = require("morgan");
const { logger } = require("../utils/logger");

function requestLogger() {
  const stream = {
    write: (message) => {
      logger.info("http_request", { message: message.trim() });
    },
  };

  return morgan("combined", { stream });
}

module.exports = { requestLogger };

