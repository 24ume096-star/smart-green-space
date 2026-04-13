const { prisma } = require("../config/prisma");

/**
 * Higher-order middleware to log administrative and automated actions into AuditLog.
 * @param {string} actionName - Descriptive name of the action (e.g., 'TRIGGER_IRRIGATION')
 * @param {Function} resourceMapper - Function that takes (req, res) and returns { id, type }
 */
function auditLog(actionName, resourceMapper = null) {
  return async (req, res, next) => {
    // We capture the original end method to log AFTER the request finishes successfully
    const originalEnd = res.end;

    res.end = async function (chunk, encoding) {
      res.end = originalEnd;
      const result = res.end(chunk, encoding);

      // Only log successful or specifically meaningful status codes
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          let resourceId = null;
          let resourceType = null;

          if (resourceMapper) {
            const mapped = resourceMapper(req, res);
            resourceId = mapped?.id;
            resourceType = mapped?.type;
          } else {
            // Default heuristics
            resourceId = req.params.parkId || req.params.id || req.body.parkId;
            resourceType = req.params.parkId ? "PARK" : null;
          }

          await prisma.auditLog.create({
            data: {
              userId: req.user?.id || null,
              action: actionName,
              resourceId: resourceId?.toString(),
              resourceType: resourceType,
              ipAddress: req.ip,
              userAgent: req.headers["user-agent"],
              metadata: {
                method: req.method,
                path: req.originalUrl,
                params: req.params,
                statusCode: res.statusCode,
              },
            },
          });
        } catch (err) {
          console.error("[AuditLog] Failed to record action:", err.message);
        }
      }

      return result;
    };

    next();
  };
}

module.exports = { auditLog };
