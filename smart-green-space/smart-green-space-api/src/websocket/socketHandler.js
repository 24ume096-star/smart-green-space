const jwt = require("jsonwebtoken");
const Redis = require("ioredis");

const { env } = require("../config/env");
const { logger } = require("../utils/logger");
const { prisma } = require("../config/prisma");

const state = {
  io: null,
};

function setIo(io) {
  state.io = io;
}

function getIo() {
  return state.io;
}

function extractToken(socket) {
  const authToken =
    socket.handshake?.auth?.token ||
    socket.handshake?.headers?.authorization ||
    socket.handshake?.headers?.Authorization ||
    null;
  if (typeof authToken !== "string") return null;
  if (authToken.startsWith("Bearer ")) return authToken.slice(7);
  return authToken;
}

function attachJwtAuth(io) {
  io.use(async (socket, next) => {
    try {
      const token = extractToken(socket);
      if (!token) {
        return next(Object.assign(new Error("Missing token"), { data: { code: "UNAUTHORIZED" } }));
      }
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, role: true, cityId: true, email: true },
      });
      if (!user) {
        return next(Object.assign(new Error("Invalid token"), { data: { code: "UNAUTHORIZED" } }));
      }
      socket.user = {
        userId: user.id,
        role: user.role,
        cityId: user.cityId,
        email: user.email,
      };
      return next();
    } catch (err) {
      return next(Object.assign(new Error("Invalid token"), { data: { code: "INVALID_TOKEN" } }));
    }
  });
}

function createConnectionLimiter() {
  const byIp = new Map();
  const WINDOW_MS = 60_000;
  const MAX_PER_WINDOW = 20;

  return function connectionLimiter(socket, next) {
    const ip =
      socket.handshake?.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
      socket.handshake?.address ||
      "unknown";
    const now = Date.now();
    const entry = byIp.get(ip) || { t: now, n: 0 };
    if (now - entry.t > WINDOW_MS) {
      entry.t = now;
      entry.n = 0;
    }
    entry.n += 1;
    byIp.set(ip, entry);
    if (entry.n > MAX_PER_WINDOW) {
      return next(Object.assign(new Error("Rate limited"), { data: { code: "RATE_LIMITED" } }));
    }
    return next();
  };
}

function roomSize(io, room) {
  const set = io.sockets.adapter.rooms.get(room);
  return set ? set.size : 0;
}

function attachRoomSubscriptions(io) {
  const MAX_ROOMS_PER_SOCKET = 20;
  const MAX_ROOM_SIZE = 2000;
  const SUBSCRIBE_WINDOW_MS = 10_000;
  const MAX_SUBS_PER_WINDOW = 10;

  io.on("connection", (socket) => {
    logger.info("socket_connected", { id: socket.id, userId: socket.user?.userId });

    // Auto-join city room if present
    if (socket.user?.cityId) {
      socket.join(`city:${socket.user.cityId}`);
    }
    // User room for personal notifications/badges
    if (socket.user?.userId) {
      socket.join(`user:${socket.user.userId}`);
    }

    let subs = { t: Date.now(), n: 0 };
    const canSubscribe = () => {
      const now = Date.now();
      if (now - subs.t > SUBSCRIBE_WINDOW_MS) subs = { t: now, n: 0 };
      subs.n += 1;
      return subs.n <= MAX_SUBS_PER_WINDOW;
    };

    const tryJoin = (room) => {
      if (!canSubscribe()) return;
      if (socket.rooms.size > MAX_ROOMS_PER_SOCKET) return;
      if (roomSize(io, room) >= MAX_ROOM_SIZE) return;
      socket.join(room);
    };

    socket.on("subscribe:park", async (payload) => {
      const parkId = payload?.parkId;
      if (typeof parkId !== "string" || parkId.length > 64) return;
      tryJoin(`park:${parkId}`);
    });

    socket.on("subscribe:city", async (payload) => {
      const cityId = payload?.cityId;
      if (typeof cityId !== "string" || cityId.length > 64) return;
      // Non-admins can only join their own city
      if (socket.user?.role !== "ADMIN" && socket.user?.cityId && socket.user.cityId !== cityId) return;
      tryJoin(`city:${cityId}`);
    });

    socket.on("disconnect", (reason) => {
      logger.info("socket_disconnected", { id: socket.id, reason, userId: socket.user?.userId });
    });
  });
}

function createParkCityCache() {
  const map = new Map(); // parkId -> { cityId, exp }
  const TTL_MS = 10 * 60_000;
  return {
    async getCityIdForPark(parkId) {
      const now = Date.now();
      const hit = map.get(parkId);
      if (hit && hit.exp > now) return hit.cityId;
      const park = await prisma.park.findUnique({ where: { id: parkId }, select: { cityId: true } });
      const cityId = park?.cityId || null;
      map.set(parkId, { cityId, exp: now + TTL_MS });
      return cityId;
    },
  };
}

function startRedisPubSubBridge(io) {
  const pubsub = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
    lazyConnect: true,
    connectTimeout: 500,
    retryStrategy: () => null,
  });

  const cache = createParkCityCache();

  pubsub.on("error", (err) => {
    logger.warn("redis_pubsub_error", { err: err.message });
  });

  // Pattern subscribe to both the new and legacy channels
  const patterns = ["alerts:*", "sensor:*", "gshi:*", "irrigation:*", "sgs:*"];

  pubsub
    .connect()
    .then(async () => {
      await pubsub.psubscribe(...patterns);
      logger.info("redis_pubsub_connected", { patterns });
    })
    .catch((err) => {
      logger.error("redis_pubsub_connect_failed", { err: err.message });
    });

  pubsub.on("pmessage", async (_pattern, channel, message) => {
    let payload;
    try {
      payload = JSON.parse(message);
    } catch {
      return;
    }

    // Alerts published as alerts:<parkId>
    if (channel.startsWith("alerts:")) {
      const parkId = payload.parkId;
      const cityId = payload.cityId;
      if (parkId) io.to(`park:${parkId}`).emit(payload.event || "alert:new", payload);
      if (cityId) io.to(`city:${cityId}`).emit(payload.event || "alert:new", payload);
      if (payload.alert?.severity === "CRITICAL") io.to("global:critical").emit("alert:new", payload);
      return;
    }

    // Sensor readings - legacy channel used by sensorsService
    if (channel === "sgs:sensor-readings" || channel.startsWith("sensor:")) {
      const parkId = payload.parkId;
      if (!parkId) return;
      const cityId = await cache.getCityIdForPark(parkId);
      io.to(`park:${parkId}`).emit("sensor:reading", { nodeId: payload.nodeId, reading: payload });
      if (cityId) io.to(`city:${cityId}`).emit("sensor:reading", { nodeId: payload.nodeId, reading: payload });
      return;
    }

    if (channel.startsWith("gshi:")) {
      const parkId = payload.parkId;
      const cityId = payload.cityId || (parkId ? await cache.getCityIdForPark(parkId) : null);
      if (parkId) io.to(`park:${parkId}`).emit("gshi:updated", payload);
      if (cityId) io.to(`city:${cityId}`).emit("gshi:updated", payload);
      return;
    }

    if (channel.startsWith("irrigation:")) {
      const parkId = payload.parkId;
      const cityId = payload.cityId || (parkId ? await cache.getCityIdForPark(parkId) : null);
      if (parkId) io.to(`park:${parkId}`).emit("irrigation:event", payload);
      if (cityId) io.to(`city:${cityId}`).emit("irrigation:event", payload);
    }
  });

  return pubsub;
}

function setupSocketLayer(io) {
  attachJwtAuth(io);
  io.use(createConnectionLimiter());
  attachRoomSubscriptions(io);
  startRedisPubSubBridge(io);
}

module.exports = { setIo, getIo, setupSocketLayer };

