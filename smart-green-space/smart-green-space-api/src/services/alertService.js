const { prisma } = require("../config/prisma");
const { redis } = require("../config/redis");
const { getIo } = require("../websocket/socketHandler");
const { logger } = require("../utils/logger");
const { getPagination, buildPaginatedResponse } = require("../utils/pagination");
const { bumpVersion, parkVersionKey, cityVersionKey } = require("../utils/cache");

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

async function createAlert({
  parkId,
  nodeId = null,
  severity,
  type,
  title,
  description,
  aiConfidence = null,
}) {
  const park = await prisma.park.findUnique({
    where: { id: parkId },
    select: { id: true, cityId: true, isActive: true },
  });
  if (!park || !park.isActive) {
    const err = new Error("Park not found or inactive");
    err.statusCode = 404;
    err.code = "NOT_FOUND";
    throw err;
  }

  const alert = await prisma.alert.create({
    data: {
      parkId,
      nodeId,
      severity,
      type,
      title,
      description,
      aiConfidence: typeof aiConfidence === "number" ? clamp01(aiConfidence) : null,
      status: "OPEN",
    },
  });

  const payload = {
    event: "alert:new",
    alert,
    parkId,
    cityId: park.cityId,
    timestamp: new Date().toISOString(),
  };

  try {
    await redis.publish(`alerts:${parkId}`, JSON.stringify(payload));
  } catch (_) {
    // non-fatal
  }

  const io = getIo();
  if (io) {
    io.to(`park:${parkId}`).emit("alert:new", payload);
    io.to(`city:${park.cityId}`).emit("alert:new", payload);
    if (alert.severity === "CRITICAL") {
      io.to("global:critical").emit("alert:new", payload);
    }
  }

  await bumpVersion(parkVersionKey(parkId));
  await bumpVersion(cityVersionKey(park.cityId));

  return alert;
}

async function listAlerts(query) {
  const { page, limit, parkId, cityId, severity, type, status, from, to } = query;
  const { skip, take } = getPagination({ page, limit });

  const where = {
    ...(parkId ? { parkId } : {}),
    ...(severity ? { severity } : {}),
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
    ...(cityId
      ? {
          park: { cityId },
        }
      : {}),
  };

  const [total, alerts] = await Promise.all([
    prisma.alert.count({ where }),
    prisma.alert.findMany({
      where,
      skip,
      take,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        park: { select: { id: true, name: true, cityId: true } },
        node: { select: { id: true, nodeCode: true } },
      },
    }),
  ]);

  return buildPaginatedResponse({ items: alerts, total, page, limit });
}

async function getAlertDetail(alertId) {
  const alert = await prisma.alert.findUnique({
    where: { id: alertId },
    include: {
      park: { select: { id: true, name: true, cityId: true } },
      node: { select: { id: true, nodeCode: true } },
    },
  });
  if (!alert) return null;

  const actions = await prisma.actionLog.findMany({
    where: { alertId },
    orderBy: { createdAt: "asc" },
  });

  return { ...alert, actionLogs: actions };
}

async function publishAlertUpdated({ alert, parkId, cityId, update }) {
  const payload = {
    event: "alert:updated",
    alertId: alert.id,
    status: alert.status,
    update,
    alert,
    parkId,
    cityId,
    timestamp: new Date().toISOString(),
  };
  try {
    await redis.publish(`alerts:${parkId}`, JSON.stringify(payload));
  } catch (_) {
    // non-fatal
  }

  const io = getIo();
  if (io) {
    io.to(`park:${parkId}`).emit("alert:updated", payload);
    io.to(`city:${cityId}`).emit("alert:updated", payload);
    if (alert.severity === "CRITICAL") io.to("global:critical").emit("alert:updated", payload);
  }
}

async function assignAlert(alertId, { assignedTo, performedBy }) {
  const alert = await prisma.alert.update({
    where: { id: alertId },
    data: {
      assignedTo,
      status: "ASSIGNED",
    },
  });

  await prisma.actionLog.create({
    data: {
      alertId: alert.id,
      parkId: alert.parkId,
      actionType: "ALERT_ASSIGNED",
      description: "Alert assigned",
      performedBy: performedBy || null,
      metadata: { assignedTo },
    },
  });

  const park = await prisma.park.findUnique({ where: { id: alert.parkId }, select: { cityId: true } });
  await publishAlertUpdated({ alert, parkId: alert.parkId, cityId: park?.cityId || null, update: { assignedTo } });
  if (park?.cityId) {
    await bumpVersion(parkVersionKey(alert.parkId));
    await bumpVersion(cityVersionKey(park.cityId));
  }
  return alert;
}

async function resolveAlert(alertId, { resolutionNote, performedBy }) {
  const alert = await prisma.alert.update({
    where: { id: alertId },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
      resolvedBy: performedBy || null,
    },
  });

  await prisma.actionLog.create({
    data: {
      alertId: alert.id,
      parkId: alert.parkId,
      actionType: "ALERT_RESOLVED",
      description: "Alert resolved",
      performedBy: performedBy || null,
      metadata: { resolutionNote: resolutionNote || null },
    },
  });

  const park = await prisma.park.findUnique({ where: { id: alert.parkId }, select: { cityId: true } });
  await publishAlertUpdated({
    alert,
    parkId: alert.parkId,
    cityId: park?.cityId || null,
    update: { resolvedAt: alert.resolvedAt, resolutionNote: resolutionNote || null },
  });
  if (park?.cityId) {
    await bumpVersion(parkVersionKey(alert.parkId));
    await bumpVersion(cityVersionKey(park.cityId));
  }
  return alert;
}

async function escalateAlert(alertId, { escalateTo, reason, performedBy }) {
  const alert = await prisma.alert.update({
    where: { id: alertId },
    data: {
      status: "ESCALATED",
      assignedTo: escalateTo,
    },
  });

  await prisma.actionLog.create({
    data: {
      alertId: alert.id,
      parkId: alert.parkId,
      actionType: "ALERT_ESCALATED",
      description: "Alert escalated",
      performedBy: performedBy || null,
      metadata: { escalateTo, reason: reason || null },
    },
  });

  const park = await prisma.park.findUnique({ where: { id: alert.parkId }, select: { cityId: true } });
  await publishAlertUpdated({
    alert,
    parkId: alert.parkId,
    cityId: park?.cityId || null,
    update: { escalateTo, reason: reason || null },
  });
  if (park?.cityId) {
    await bumpVersion(parkVersionKey(alert.parkId));
    await bumpVersion(cityVersionKey(park.cityId));
  }
  return alert;
}

async function getCityAlertSummary(cityId) {
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [openCritical, openWarning, openInfo, resolved24h, avgResolution] = await Promise.all([
    prisma.alert.count({
      where: { park: { cityId }, status: { in: ["OPEN", "ASSIGNED", "ESCALATED"] }, severity: "CRITICAL" },
    }),
    prisma.alert.count({
      where: { park: { cityId }, status: { in: ["OPEN", "ASSIGNED", "ESCALATED"] }, severity: "WARNING" },
    }),
    prisma.alert.count({
      where: { park: { cityId }, status: { in: ["OPEN", "ASSIGNED", "ESCALATED"] }, severity: "INFO" },
    }),
    prisma.alert.count({
      where: { park: { cityId }, status: "RESOLVED", resolvedAt: { gte: last24h } },
    }),
    prisma.$queryRawUnsafe(
      `
      SELECT AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt")) / 3600.0)::float AS "avgHours"
      FROM "Alert"
      WHERE "resolvedAt" IS NOT NULL
        AND "createdAt" >= $1::timestamptz
        AND "parkId" IN (SELECT "id" FROM "Park" WHERE "cityId" = $2)
    `,
      last7d,
      cityId,
    ),
  ]);

  return {
    critical: openCritical,
    warning: openWarning,
    info: openInfo,
    resolved24h,
    avgResolutionHours: Number(avgResolution?.[0]?.avgHours ?? 0) || 0,
  };
}

async function autoResolveCheck() {
  const open = await prisma.alert.findMany({
    where: { status: { in: ["OPEN", "ASSIGNED", "ESCALATED"] } },
    select: { id: true, type: true, parkId: true, nodeId: true, createdAt: true },
    take: 500,
    orderBy: { createdAt: "asc" },
  });

  let resolved = 0;
  for (const a of open) {
    try {
      const shouldResolve = await shouldAutoResolve(a);
      if (!shouldResolve) continue;
      await resolveAlert(a.id, { resolutionNote: "Auto-resolved (condition cleared)", performedBy: null });
      resolved += 1;
    } catch (err) {
      logger.warn("auto_resolve_failed", { alertId: a.id, err: err.message });
    }
  }

  return { checked: open.length, resolved };
}

async function shouldAutoResolve(alert) {
  // Only auto-resolve a subset of alert types with clear, measurable conditions.
  if (alert.type === "SENSOR_OFFLINE") {
    if (!alert.nodeId) return false;
    const node = await prisma.sensorNode.findUnique({
      where: { id: alert.nodeId },
      select: { lastPingAt: true, status: true, isActive: true },
    });
    if (!node || !node.isActive || !node.lastPingAt) return false;
    const ageMs = Date.now() - new Date(node.lastPingAt).getTime();
    return ageMs < 10 * 60_000 && node.status === "ONLINE";
  }

  if (alert.type === "HEAT_STRESS") {
    const last30m = new Date(Date.now() - 30 * 60_000);
    const agg = await prisma.sensorReading.aggregate({
      where: { node: { parkId: alert.parkId, isActive: true }, timestamp: { gte: last30m } },
      _avg: { temperature: true },
    });
    const t = agg._avg.temperature;
    if (typeof t !== "number") return false;
    return t < 33;
  }

  if (alert.type === "FLOOD_RISK") {
    const last30m = new Date(Date.now() - 30 * 60_000);
    const agg = await prisma.sensorReading.aggregate({
      where: { node: { parkId: alert.parkId, isActive: true }, timestamp: { gte: last30m } },
      _avg: { soilMoisture: true },
    });
    const m = agg._avg.soilMoisture;
    if (typeof m !== "number") return false;
    return m < 75;
  }

  return false;
}

module.exports = {
  createAlert,
  listAlerts,
  getAlertDetail,
  assignAlert,
  resolveAlert,
  escalateAlert,
  getCityAlertSummary,
  autoResolveCheck,
  __private: { shouldAutoResolve },
};

