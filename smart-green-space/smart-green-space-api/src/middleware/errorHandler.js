const { ZodError } = require("zod");
const { logger } = require("../utils/logger");

function errorHandler() {
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, next) => {
    const status = err.statusCode || err.status || 500;
    const code = err.code || (status === 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR");
    const isServerError = status >= 500;
    let details = err.details;

    if (err instanceof ZodError) {
      return res.status(422).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request body",
          details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        },
      });
    }

    if (isServerError) {
      logger.error("request_error", {
        code,
        message: err.message,
        stack: err.stack,
        path: req.originalUrl,
        method: req.method,
      });
      details = null;
    }

    res.status(status).json({
      success: false,
      error: {
        code,
        message: isServerError ? "Internal server error" : err.message || "Request failed",
        details: envSafeDetails(details),
      },
    });
  };
}

function envSafeDetails(details) {
  // Avoid leaking sensitive internal objects; keep error responses structured but minimal
  if (!details) return null;
  if (typeof details === "string") return details;
  if (Array.isArray(details)) return details;
  if (typeof details === "object") return details;
  return String(details);
}

module.exports = { errorHandler };

