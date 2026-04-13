const jwt = require("jsonwebtoken");
const { env } = require("../config/env");
const { prisma } = require("../config/prisma");

function requireAuth() {
  return (req, res, next) => {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Missing bearer token",
          details: null,
        },
      });
    }

    try {
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
      return prisma.user
        .findUnique({
          where: { id: payload.userId },
          select: {
            id: true,
            email: true,
            role: true,
            cityId: true,
            name: true,
            isVerified: true,
          },
        })
        .then((user) => {
          if (!user) {
            return res.status(401).json({
              success: false,
              error: {
                code: "UNAUTHORIZED",
                message: "Invalid or expired access token",
                details: null,
              },
            });
          }

          req.user = {
            userId: user.id,
            email: user.email,
            role: user.role,
            cityId: user.cityId,
            name: user.name,
            isVerified: user.isVerified,
          };
          return next();
        })
        .catch((err) => next(err));
    } catch (_) {
      return res.status(401).json({
        success: false,
        error: {
          code: "INVALID_TOKEN",
          message: "Invalid or expired access token",
          details: null,
        },
      });
    }
  };
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
          details: null,
        },
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "You are not allowed to access this resource",
          details: null,
        },
      });
    }

    return next();
  };
}

function requireCityAccess() {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
          details: null,
        },
      });
    }

    if (req.user.role === "ADMIN") {
      return next();
    }

    const resourceCityId =
      req.params.cityId || req.body.cityId || req.query.cityId || req.resource?.cityId || null;

    if (!resourceCityId || req.user.cityId !== resourceCityId) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "City access denied for this resource",
          details: null,
        },
      });
    }

    return next();
  };
}

module.exports = { requireAuth, requireRole, requireCityAccess };
