const { prisma } = require("../config/prisma");
const { getIo } = require("../websocket/socketHandler");
const { logger } = require("../utils/logger");

function badgeDef(code, label) {
  return { code, label };
}

const BADGES = {
  OBSERVER: badgeDef("OBSERVER", "Observer"),
  GUARDIAN: badgeDef("GUARDIAN", "Guardian"),
  CHAMPION: badgeDef("CHAMPION", "Champion"),
  WILDLIFE_SPOTTER: badgeDef("WILDLIFE_SPOTTER", "Wildlife Spotter 🦅"),
  RELIABLE_REPORTER: badgeDef("RELIABLE_REPORTER", "Reliable Reporter"),
};

async function awardBadges(userId) {
  if (!userId) return { awarded: [] };

  const [reportCount, wildlifeCount, verifiedCount, existing] = await Promise.all([
    prisma.citizenReport.count({ where: { submittedBy: userId } }),
    prisma.citizenReport.count({ where: { submittedBy: userId, type: "WILDLIFE" } }),
    prisma.citizenReport.count({ where: { submittedBy: userId, status: "VERIFIED" } }),
    prisma.userBadge.findMany({ where: { userId }, select: { code: true } }),
  ]);

  const have = new Set(existing.map((b) => b.code));
  const toAward = [];

  if (reportCount >= 5) toAward.push(BADGES.OBSERVER);
  if (reportCount >= 20) toAward.push(BADGES.GUARDIAN);
  if (reportCount >= 50) toAward.push(BADGES.CHAMPION);
  if (wildlifeCount >= 5) toAward.push(BADGES.WILDLIFE_SPOTTER);
  if (verifiedCount >= 10) toAward.push(BADGES.RELIABLE_REPORTER);

  const newBadges = toAward.filter((b) => !have.has(b.code));
  if (newBadges.length === 0) return { awarded: [] };

  await prisma.userBadge.createMany({
    data: newBadges.map((b) => ({ userId, code: b.code, label: b.label })),
    skipDuplicates: true,
  });

  const io = getIo();
  if (io) {
    io.to(`user:${userId}`).emit("badge:awarded", { userId, badges: newBadges });
  }

  logger.info("badges_awarded", { userId, count: newBadges.length });
  return { awarded: newBadges };
}

module.exports = { awardBadges, BADGES };

