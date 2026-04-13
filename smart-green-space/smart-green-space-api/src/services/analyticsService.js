const { prisma } = require("../config/prisma");
const { cacheAsideJson, getVersion, parkVersionKey, cityVersionKey } = require("../utils/cache");
const { getGshiHistory, getCityRankings, getParkForecast, getCityAverage } = require("./gshiService");

function round2(n) {
  return Number((n ?? 0).toFixed(2));
}

async function getParkOverviewRaw(parkId) {
  const now = new Date();
  const from7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const to = now;

  const [gshiCurrent, gshiTrend7dRows, activeAlerts, onlineSensors, speciesCount, lastSatelliteCapture, topAlert] =
    await Promise.all([
      prisma.gshiScore.findFirst({ where: { parkId }, orderBy: { calculatedAt: "desc" } }),
      prisma.gshiScore.findMany({
        where: { parkId, calculatedAt: { gte: from7d, lte: to } },
        orderBy: { calculatedAt: "asc" },
        select: { calculatedAt: true, overallScore: true },
      }),
      prisma.alert.count({ where: { parkId, status: { in: ["OPEN", "ASSIGNED", "ESCALATED"] } } }),
      prisma.sensorNode.count({ where: { parkId, isActive: true, status: "ONLINE" } }),
      prisma.biodiversityLog
        .findMany({ where: { parkId }, select: { speciesName: true } })
        .then((rows) => new Set(rows.map((r) => r.speciesName)).size),
      prisma.satelliteImage.findFirst({
        where: { parkId },
        orderBy: { capturedAt: "desc" },
        select: { capturedAt: true, source: true, ndviMean: true, thermalMeanC: true },
      }),
      prisma.alert.groupBy({
        by: ["type"],
        where: { parkId, status: { in: ["OPEN", "ASSIGNED", "ESCALATED"] } },
        _count: { type: true },
        orderBy: { _count: { type: "desc" } },
        take: 1,
      }),
    ]);

  const scores = gshiTrend7dRows.map((r) => Number(r.overallScore ?? 0)).filter((n) => Number.isFinite(n));
  const gshiTrend7d =
    scores.length < 2 ? null : round2(scores[scores.length - 1] - scores[0]);

  return {
    gshiCurrent,
    gshiTrend7d,
    activeAlerts,
    onlineSensors,
    speciesCount,
    waterSavedL: null, // placeholder until irrigation water accounting is defined
    topAlertType: topAlert?.[0]?.type || null,
    lastSatelliteCapture,
  };
}

async function getParkOverview(parkId) {
  const v = await getVersion(parkVersionKey(parkId));
  const key = `analytics:park:${parkId}:overview:v${v}`;
  return cacheAsideJson({ key, ttlSeconds: 300, loader: () => getParkOverviewRaw(parkId) }).then((r) => r.data);
}

async function getParkGshiTrend(parkId, query) {
  const v = await getVersion(parkVersionKey(parkId));
  const key = `analytics:park:${parkId}:gshi-trend:${query.interval}:${query.from.toISOString()}:${query.to.toISOString()}:v${v}`;
  return cacheAsideJson({
    key,
    ttlSeconds: 300,
    loader: () => getGshiHistory(parkId, query),
  }).then((r) => r.data);
}

async function getCityParkRankings(cityId) {
  const v = await getVersion(cityVersionKey(cityId));
  const key = `analytics:city:${cityId}:rankings:v${v}`;
  return cacheAsideJson({ key, ttlSeconds: 300, loader: () => getCityRankings(cityId) }).then((r) => r.data);
}

async function getParkAlertAnalyticsRaw(parkId, { from, to }) {
  const [byType, byWeek, resolvedAgg, openCount, resolvedCount] = await Promise.all([
    prisma.alert.groupBy({
      by: ["type"],
      where: { parkId, createdAt: { gte: from, lte: to } },
      _count: { type: true },
    }),
    prisma.$queryRawUnsafe(
      `
      SELECT date_trunc('week', "createdAt") AS bucket,
             "type" as type,
             COUNT(*)::int AS count
      FROM "Alert"
      WHERE "parkId" = $1
        AND "createdAt" >= $2::timestamptz
        AND "createdAt" <= $3::timestamptz
      GROUP BY bucket, type
      ORDER BY bucket ASC
    `,
      parkId,
      from,
      to,
    ),
    prisma.$queryRawUnsafe(
      `
      SELECT AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt")) / 3600.0)::float AS "avgHours"
      FROM "Alert"
      WHERE "parkId" = $1
        AND "resolvedAt" IS NOT NULL
        AND "resolvedAt" >= $2::timestamptz
        AND "resolvedAt" <= $3::timestamptz
    `,
      parkId,
      from,
      to,
    ),
    prisma.alert.count({ where: { parkId, status: { in: ["OPEN", "ASSIGNED", "ESCALATED"] } } }),
    prisma.alert.count({ where: { parkId, status: "RESOLVED", resolvedAt: { gte: from, lte: to } } }),
  ]);

  return {
    byCategory: byType.map((r) => ({ type: r.type, count: r._count.type })),
    byWeek,
    avgResolutionHours: Number(resolvedAgg?.[0]?.avgHours ?? 0) || 0,
    resolvedCount,
    openCount,
  };
}

async function getParkAlertAnalytics(parkId, query) {
  const v = await getVersion(parkVersionKey(parkId));
  const key = `analytics:park:${parkId}:alerts:${query.from.toISOString()}:${query.to.toISOString()}:v${v}`;
  return cacheAsideJson({ key, ttlSeconds: 300, loader: () => getParkAlertAnalyticsRaw(parkId, query) }).then(
    (r) => r.data,
  );
}

function seasonalAdjust(date) {
  const start = new Date(date.getFullYear(), 0, 1);
  const day = Math.floor((date - start) / 86400000);
  return Math.sin((day / 365) * Math.PI * 2);
}

async function getParkAiForecast(parkId) {
  const v = await getVersion(parkVersionKey(parkId));
  const key = `analytics:park:${parkId}:ai-forecast:v${v}`;
  return cacheAsideJson({
    key,
    ttlSeconds: 300,
    loader: async () => {
      const base = await getParkForecast(parkId); // [{date,predictedScore,confidence}]
      const now = new Date();
      const forecasts = base.map((p) => {
        const d = new Date(p.date);
        const season = seasonalAdjust(d);
        const gshi = round2(clamp(p.predictedScore + season * 1.2, 0, 100));
        const irrigation = Math.round(clamp(1200 + (1 - season) * 600, 300, 5000));
        const floodRisk = round2(clamp((1 + season) / 2, 0, 1));
        const heatRisk = season < 0 ? "LOW" : season < 0.4 ? "MODERATE" : "HIGH";
        return {
          date: d.toISOString(),
          gshi,
          irrigationNeedL: irrigation,
          floodRisk,
          heatRiskLevel: heatRisk,
          confidence: p.confidence ? Number(p.confidence) / 100 : 0.6,
        };
      });

      // Ensure 7 points even if base is empty
      if (forecasts.length === 0) {
        const fallback = [];
        for (let i = 1; i <= 7; i += 1) {
          const d = new Date(now);
          d.setDate(d.getDate() + i);
          const season = seasonalAdjust(d);
          fallback.push({
            date: d.toISOString(),
            gshi: 60,
            irrigationNeedL: Math.round(1200 + (1 - season) * 600),
            floodRisk: round2((1 + season) / 2),
            heatRiskLevel: season < 0 ? "LOW" : season < 0.4 ? "MODERATE" : "HIGH",
            confidence: 0.5,
          });
        }
        return { forecasts: fallback };
      }
      return { forecasts };
    },
  }).then((r) => r.data);
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

async function getCityDashboardSummaryRaw(cityId) {
  const now = new Date();
  const from30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const parks = await prisma.park.findMany({
    where: { cityId, isActive: true },
    select: { id: true, name: true },
  });

  const [activeNodes, avgGshi, criticalAlerts, speciesToday, gshiTrendRows, alertsByCategory, topAlerts] =
    await Promise.all([
      prisma.sensorNode.count({ where: { park: { cityId }, isActive: true, status: "ONLINE" } }),
      getCityAverage(cityId),
      prisma.alert.count({
        where: { park: { cityId }, status: { in: ["OPEN", "ASSIGNED", "ESCALATED"] }, severity: "CRITICAL" },
      }),
      prisma.biodiversityLog.count({ where: { park: { cityId }, detectedAt: { gte: new Date(now.toDateString()) } } }),
      prisma.$queryRawUnsafe(
        `
        SELECT date_trunc('day', "calculatedAt") AS bucket,
               AVG("overallScore")::float AS "overallScore"
        FROM "GshiScore"
        WHERE "calculatedAt" >= $1::timestamptz
          AND "parkId" IN (SELECT "id" FROM "Park" WHERE "cityId" = $2)
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
        from30d,
        cityId,
      ),
      prisma.alert.groupBy({
        by: ["type"],
        where: { park: { cityId }, status: { in: ["OPEN", "ASSIGNED", "ESCALATED"] } },
        _count: { type: true },
      }),
      prisma.alert.findMany({
        where: { park: { cityId }, status: { in: ["OPEN", "ASSIGNED", "ESCALATED"] } },
        orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
        take: 5,
      }),
    ]);

  return {
    totalParks: parks.length,
    activeNodes,
    avgGshi: avgGshi?.averageGshi ?? null,
    criticalAlerts,
    speciesDetectedToday: speciesToday,
    waterSavedMonth: null,
    gshiTrend: gshiTrendRows,
    alertsByCategory: alertsByCategory.map((r) => ({ type: r.type, count: r._count.type })),
    topAlerts,
  };
}

async function getCityDashboardSummary(cityId) {
  const v = await getVersion(cityVersionKey(cityId));
  const key = `analytics:city:${cityId}:dashboard-summary:v${v}`;
  return cacheAsideJson({ key, ttlSeconds: 300, loader: () => getCityDashboardSummaryRaw(cityId) }).then((r) => r.data);
}

module.exports = {
  getParkOverview,
  getParkGshiTrend,
  getCityParkRankings,
  getParkAlertAnalytics,
  getParkAiForecast,
  getCityDashboardSummary,
};

