const jwt = require("jsonwebtoken");
const { env } = require("../config/env");
const { prisma } = require("../config/prisma");

function optionalAuth() {
  return (req, res, next) => {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return next();

    try {
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
      return prisma.user
        .findUnique({
          where: { id: payload.userId },
          select: { id: true, email: true, role: true, cityId: true, name: true, isVerified: true },
        })
        .then((user) => {
          if (user) {
            req.user = {
              userId: user.id,
              email: user.email,
              role: user.role,
              cityId: user.cityId,
              name: user.name,
              isVerified: user.isVerified,
            };
          }
          return next();
        })
        .catch((err) => next(err));
    } catch (_) {
      return next();
    }
  };
}

module.exports = { optionalAuth };

