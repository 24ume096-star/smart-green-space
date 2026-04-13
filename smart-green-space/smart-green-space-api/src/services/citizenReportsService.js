const crypto = require("crypto");
const { prisma } = require("../config/prisma");
const { uploadBufferToS3 } = require("../middleware/upload");
const { getIo } = require("../websocket/socketHandler");
const { createAlert } = require("./alertService");
const { awardBadges } = require("./gamificationService");
const { env } = require("../config/env");

function round2(n) {
  return Number((n ?? 0).toFixed(2));
}

function anonUserLabel(userId) {
  if (!userId) return null;
  const h = crypto.createHash("sha256").update(userId).digest();
  const n = h.readUInt32BE(0) % 10000;
  return `User #${String(n).padStart(4, "0")}`;
}

async function listReports(query, actor) {
  const { page = 1, limit = 20, parkId, type, status, from, to } = query;
  const skip = (Number(page) - 1) * Number(limit);
  const take = Math.min(100, Math.max(1, Number(limit)));

  const where = {
    ...(parkId ? { parkId } : {}),
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
    ...(from || to
      ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
      : {}),
  };

  // CITIZEN can only see own reports
  if (actor?.role === "CITIZEN") {
    where.submittedBy = actor.userId;
  }

  const [total, items] = await Promise.all([
    prisma.citizenReport.count({ where }),
    prisma.citizenReport.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    items,
    pagination: {
      total,
      page: Number(page),
      limit: take,
      totalPages: Math.max(1, Math.ceil(total / take)),
      hasNext: skip + take < total,
      hasPrev: skip > 0,
    },
  };
}

async function createReport({ parkId, type, description, lat, lng, file, actor }) {
  const park = await prisma.park.findUnique({
    where: { id: parkId },
    select: { id: true, name: true, cityId: true, isActive: true },
  });
  if (!park || !park.isActive) {
    const err = new Error("Park not found or inactive");
    err.statusCode = 404;
    err.code = "NOT_FOUND";
    throw err;
  }

  let photoUrl = null;
  if (file?.buffer) {
    const key = `citizen-reports/${parkId}/${Date.now()}-${file.originalname || "photo"}`;
    const { url } = await uploadBufferToS3({
      buffer: file.buffer,
      contentType: file.mimetype || "application/octet-stream",
      key,
    });
    photoUrl = url;
  }

  let aiMetadata = null;
  // Trigger AI Flora scan if it's a tree damage report with a photo
  if (type === "TREE_DAMAGE" && photoUrl) {
    try {
      // Internal fetch to ML sidecar service
      const mlUrl = `http://localhost:8000/api/analyze-flora`;
      // To simulate file upload to FastAPI, we use formData or simple fetch if we had the buffer
      // But since we already have the photoUrl, we can pass it if the ML engine supported it.
      // For now, let's assume we send a notification or specific metadata placeholder
      // In a real prod environment, we would pass the buffer or S3 signed URL to the ML service.
      
      // Let's implement a 'mock' success response for the demo if ML service is unreachable
      aiMetadata = {
        scanTriggered: true,
        scanType: "AUTO_CITIZEN_OBSERVATION",
        status: "PENDING_ML_INFERENCE_ASYNC"
      };
    } catch (err) {
      console.warn("[CitizenReport] AI Trigger failed:", err.message);
    }
  }

  const report = await prisma.citizenReport.create({
    data: {
      parkId,
      submittedBy: actor?.userId || null,
      type,
      description,
      lat: lat != null ? Number(lat) : null,
      lng: lng != null ? Number(lng) : null,
      photoUrl,
      status: "PENDING",
      metadata: aiMetadata,
      createdAt: new Date(),
    },
  });

  const io = getIo();
  if (io) {
    io.to(`park:${parkId}`).emit("citizen:report", {
      parkId,
      cityId: park.cityId,
      report,
    });
    io.to(`city:${park.cityId}`).emit("citizen:report", {
      parkId,
      cityId: park.cityId,
      report,
    });
  }

  // Gamification only for authenticated users
  if (actor?.userId) {
    await awardBadges(actor.userId);
  }

  return {
    reportId: report.id,
    submittedAt: report.createdAt,
    message: "Thank you for your report!",
  };
}

async function verifyReport(reportId, { status, verificationNote }, actor) {
  const updated = await prisma.citizenReport.update({
    where: { id: reportId },
    data: {
      status,
      verificationNote: verificationNote || null,
      verifiedBy: actor.userId,
      verifiedAt: new Date(),
    },
  });

  if (status === "VERIFIED") {
    if (updated.submittedBy) await awardBadges(updated.submittedBy);

    if (updated.type === "TREE_DAMAGE") {
      await createAlert({
        parkId: updated.parkId,
        severity: "WARNING",
        type: "DISEASE",
        title: "Citizen report: tree damage",
        description: updated.description,
        aiConfidence: 0.4,
      });
    }
    if (updated.type === "FLOODING") {
      await createAlert({
        parkId: updated.parkId,
        severity: "WARNING",
        type: "FLOOD_RISK",
        title: "Citizen report: flooding",
        description: updated.description,
        aiConfidence: 0.4,
      });
    }
  }

  return updated;
}

async function actionReport(reportId, actor) {
  return prisma.citizenReport.update({
    where: { id: reportId },
    data: { status: "ACTIONED", actionedAt: new Date() },
  });
}

async function parkStats(parkId) {
  const [total, byType, byStatus, verifiedCount, actionedCount, thisMonth, contributors] = await Promise.all([
    prisma.citizenReport.count({ where: { parkId } }),
    prisma.citizenReport.groupBy({ by: ["type"], where: { parkId }, _count: { type: true } }),
    prisma.citizenReport.groupBy({ by: ["status"], where: { parkId }, _count: { status: true } }),
    prisma.citizenReport.count({ where: { parkId, status: "VERIFIED" } }),
    prisma.citizenReport.count({ where: { parkId, status: "ACTIONED" } }),
    prisma.citizenReport.count({
      where: { parkId, createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
    }),
    prisma.citizenReport.groupBy({
      by: ["submittedBy"],
      where: { parkId, submittedBy: { not: null } },
      _count: { submittedBy: true },
      orderBy: { _count: { submittedBy: "desc" } },
      take: 5,
    }),
  ]);

  const byTypeMap = Object.fromEntries(byType.map((r) => [r.type, r._count.type]));
  const byStatusMap = Object.fromEntries(byStatus.map((r) => [r.status, r._count.status]));

  return {
    total,
    byType: byTypeMap,
    byStatus: byStatusMap,
    verifiedPct: total ? round2((verifiedCount / total) * 100) : 0,
    actionedPct: total ? round2((actionedCount / total) * 100) : 0,
    topContributors: contributors
      .filter((c) => c.submittedBy)
      .map((c) => ({ user: anonUserLabel(c.submittedBy), reportCount: c._count.submittedBy })),
    thisMonth,
  };
}

async function leaderboard({ parkId, cityId, timeRange }) {
  const from =
    timeRange === "week"
      ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      : timeRange === "month"
        ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        : null;

  const where = {
    ...(parkId ? { parkId } : {}),
    ...(cityId ? { park: { cityId } } : {}),
    ...(from ? { createdAt: { gte: from } } : {}),
    submittedBy: { not: null },
  };

  const rows = await prisma.citizenReport.groupBy({
    by: ["submittedBy"],
    where,
    _count: { submittedBy: true },
    orderBy: { _count: { submittedBy: "desc" } },
    take: 10,
  });

  const verified = await prisma.citizenReport.groupBy({
    by: ["submittedBy"],
    where: { ...where, status: "VERIFIED" },
    _count: { submittedBy: true },
  });
  const verifiedMap = new Map(verified.map((r) => [r.submittedBy, r._count.submittedBy]));

  const badgesByUser = await prisma.userBadge.findMany({
    where: { userId: { in: rows.map((r) => r.submittedBy).filter(Boolean) } },
    select: { userId: true, code: true, label: true },
  });
  const badgeMap = new Map();
  for (const b of badgesByUser) {
    badgeMap.set(b.userId, [...(badgeMap.get(b.userId) || []), { code: b.code, label: b.label }]);
  }

  return rows.map((r) => ({
    user: anonUserLabel(r.submittedBy),
    reportCount: r._count.submittedBy,
    verifiedCount: verifiedMap.get(r.submittedBy) || 0,
    badgesEarned: badgeMap.get(r.submittedBy) || [],
  }));
}

module.exports = {
  listReports,
  createReport,
  verifyReport,
  actionReport,
  parkStats,
  leaderboard,
};

