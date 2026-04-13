const { prisma } = require("../config/prisma");
const { getIo } = require("../websocket/socketHandler");
const { logger } = require("../utils/logger");
const { bumpVersion, parkVersionKey, cityVersionKey } = require("../utils/cache");

async function subscribe({ userId, parkId, deviceToken, platform }) {
  const sub = await prisma.pushSubscription.upsert({
    where: { parkId_deviceToken: { parkId, deviceToken } },
    update: { userId, platform },
    create: { userId, parkId, deviceToken, platform },
  });
  await bumpVersion(parkVersionKey(parkId));
  return sub;
}

async function unsubscribe({ parkId, deviceToken }) {
  await prisma.pushSubscription.delete({
    where: { parkId_deviceToken: { parkId, deviceToken } },
  });
  await bumpVersion(parkVersionKey(parkId));
  return { ok: true };
}

async function myNotifications(userId) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

async function pushToPark({ parkId, actor, title, body, type, data }) {
  const park = await prisma.park.findUnique({ where: { id: parkId }, select: { id: true, cityId: true } });
  if (!park) {
    const err = new Error("Park not found");
    err.statusCode = 404;
    throw err;
  }

  const subs = await prisma.pushSubscription.findMany({
    where: { parkId },
    select: { userId: true },
  });
  const userIds = Array.from(new Set(subs.map((s) => s.userId)));

  if (userIds.length === 0) {
    logger.info("push_mock_no_subscribers", { parkId, title, type, actorId: actor.userId });
    return { delivered: 0 };
  }

  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      parkId,
      cityId: park.cityId,
      title,
      body,
      type,
      data: data || null,
    })),
  });

  const io = getIo();
  if (io) {
    for (const userId of userIds) {
      io.to(`user:${userId}`).emit("notification:push", { title, body, type, data: data || null, parkId });
    }
    io.to(`park:${parkId}`).emit("notification:push", { title, body, type, data: data || null, parkId });
    io.to(`city:${park.cityId}`).emit("notification:push", { title, body, type, data: data || null, parkId });
  }

  await bumpVersion(parkVersionKey(parkId));
  await bumpVersion(cityVersionKey(park.cityId));
  logger.info("push_mock_sent_park", { parkId, users: userIds.length, title, type });
  return { delivered: userIds.length };
}

async function pushToCity({ cityId, actor, title, body, type, data }) {
  const users = await prisma.user.findMany({ where: { cityId }, select: { id: true } });
  const userIds = users.map((u) => u.id);
  if (userIds.length === 0) return { delivered: 0 };

  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      cityId,
      title,
      body,
      type,
      data: data || null,
    })),
  });

  const io = getIo();
  if (io) {
    for (const userId of userIds) {
      io.to(`user:${userId}`).emit("notification:push", { title, body, type, data: data || null, cityId });
    }
    io.to(`city:${cityId}`).emit("notification:push", { title, body, type, data: data || null, cityId });
  }

  await bumpVersion(cityVersionKey(cityId));
  logger.info("push_mock_sent_city", { cityId, users: userIds.length, title, type });
  return { delivered: userIds.length };
}

module.exports = {
  subscribe,
  unsubscribe,
  myNotifications,
  pushToPark,
  pushToCity,
};

