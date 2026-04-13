const rateLimit = require("express-rate-limit");

/**
 * Standard rate limiter for high-cost AI operations.
 * 10 requests per minute per IP.
 */
const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10,
  message: {
    error: "Too many AI chat requests. Please try again after a minute.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Limiter for expensive geospatial calculations.
 * 5 requests per minute per IP.
 */
const geoLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  message: {
    error: "Too many calculation requests. Please wait.",
  },
});

/**
 * Global rate limiter for general API stability.
 * 100 requests per 15 minutes per IP.
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { aiLimiter, geoLimiter, globalLimiter };
