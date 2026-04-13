const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { prisma } = require("../config/prisma");
const { env } = require("../config/env");
const { logger } = require("../utils/logger");

const ACCESS_TTL = `${env.JWT_ACCESS_TTL_MIN}m`;
const REFRESH_TTL = `${env.JWT_REFRESH_TTL_DAYS}d`;
const BCRYPT_ROUNDS = 12;

function toSafeUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    cityId: user.cityId,
    name: user.name,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt,
  };
}

function createPayload(user) {
  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    cityId: user.cityId || null,
  };
}

function signAccessToken(user) {
  return jwt.sign(createPayload(user), env.JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TTL,
  });
}

function signRefreshToken(user) {
  return jwt.sign(createPayload(user), env.JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TTL,
  });
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function unauthorized(message = "Invalid credentials") {
  const error = new Error(message);
  error.statusCode = 401;
  error.code = "UNAUTHORIZED";
  return error;
}

async function registerUser({ name, email, password, role, cityId }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const error = new Error("Email is already registered");
    error.statusCode = 422;
    error.code = "VALIDATION_ERROR";
    throw error;
  }

  if (cityId) {
    const city = await prisma.city.findUnique({ where: { id: cityId }, select: { id: true } });
    if (!city) {
      const error = new Error("Invalid cityId");
      error.statusCode = 422;
      error.code = "VALIDATION_ERROR";
      throw error;
    }
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: role || "CITIZEN",
      cityId: cityId || null,
      isVerified: false,
    },
  });

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  const refreshTokenHash = hashToken(refreshToken);

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: refreshTokenHash, lastLoginAt: new Date() },
  });

  logger.info("mock_email_verification_sent", {
    to: updatedUser.email,
    subject: "Verify your Smart Green Space account",
  });

  return {
    user: toSafeUser(updatedUser),
    accessToken,
    refreshToken,
  };
}

async function loginUser({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw unauthorized();

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw unauthorized();

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  const refreshTokenHash = hashToken(refreshToken);

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      refreshToken: refreshTokenHash,
      lastLoginAt: new Date(),
    },
  });

  return {
    user: toSafeUser(updatedUser),
    accessToken,
    refreshToken,
  };
}

async function refreshAccessToken(refreshToken) {
  let payload;
  try {
    payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
  } catch (_) {
    throw unauthorized("Invalid or expired refresh token");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  });

  if (!user || !user.refreshToken) {
    throw unauthorized("Invalid or expired refresh token");
  }

  const tokenHash = hashToken(refreshToken);
  if (user.refreshToken !== tokenHash) {
    throw unauthorized("Invalid or expired refresh token");
  }

  return { accessToken: signAccessToken(user) };
}

async function logoutUser(userId) {
  await prisma.user.update({
    where: { id: userId },
    data: { refreshToken: null },
  });
}

async function forgotPassword(email) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiry = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: expiry,
    },
  });

  logger.info("mock_password_reset_email_sent", {
    to: user.email,
    subject: "Reset your Smart Green Space password",
    resetToken: token,
  });
}

async function resetPassword({ token, newPassword }) {
  const tokenHash = hashToken(token);
  const user = await prisma.user.findFirst({
    where: {
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { gt: new Date() },
    },
  });

  if (!user) {
    throw unauthorized("Invalid or expired reset token");
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      refreshToken: null,
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
    },
  });
}

async function getMe(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw unauthorized("Authentication required");
  }
  return toSafeUser(user);
}

module.exports = {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  forgotPassword,
  resetPassword,
  getMe,
};
