const express = require("express");
const { validate } = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const {
  registerSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require("../schemas/authSchemas");
const {
  register,
  login,
  refresh,
  logout,
  forgotPasswordHandler,
  resetPasswordHandler,
  me,
} = require("../controllers/authController");

/**
 * @openapi
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               role: { type: string, enum: [ADMIN, CITY_OFFICER, RESEARCHER, CITIZEN] }
 *               cityId: { type: string }
 *     responses:
 *       201: { description: User registered }
 *       422: { description: Validation error }
 *
 * /api/v1/auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200: { description: Login successful }
 *       401: { description: Invalid credentials }
 *
 * /api/v1/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200: { description: New access token }
 *       401: { description: Invalid refresh token }
 *
 * /api/v1/auth/logout:
 *   post:
 *     summary: Logout current user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Logged out }
 *       401: { description: Unauthorized }
 *
 * /api/v1/auth/forgot-password:
 *   post:
 *     summary: Send password reset token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200: { description: Reset email accepted }
 *
 * /api/v1/auth/reset-password:
 *   post:
 *     summary: Reset password using token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newPassword]
 *             properties:
 *               token: { type: string }
 *               newPassword: { type: string, minLength: 8 }
 *     responses:
 *       200: { description: Password reset successful }
 *       401: { description: Invalid/expired token }
 *
 * /api/v1/auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Current user profile }
 *       401: { description: Unauthorized }
 */
function authRoutes() {
  const router = express.Router();

  router.post("/register", validate(registerSchema), register);
  router.post("/login", validate(loginSchema), login);
  router.post("/refresh", validate(refreshSchema), refresh);
  router.post("/logout", requireAuth(), logout);
  router.post("/forgot-password", validate(forgotPasswordSchema), forgotPasswordHandler);
  router.post("/reset-password", validate(resetPasswordSchema), resetPasswordHandler);
  router.get("/me", requireAuth(), me);

  return router;
}

module.exports = { authRoutes };
