const { prisma } = require("../config/prisma");
const { redis } = require("../config/redis");
const { bumpVersion, parkVersionKey, cityVersionKey } = require("../utils/cache");

// ── Weights (7-component model) ───────────────────────────────────────────────
const WEIGHTS = {
  vegetationScore: 0.22,
  thermalScore: 0.18,
  waterScore: 0.17,
  biodiversityScore: 0.15,
  airQualityScore: 0.10,
  infrastructureScore: 0.09,
  treeHealthScore: 0.09,
};

// ── Delhi seasonal NDVI baselines (monthly) ───────────────────────────────────
// Derived from MODIS/NDVI climatology for Delhi NCR parks
const DELHI_NDVI_SEASONAL = {
  1: 0.38, 2: 0.36, 3: 0.32, 4: 0.28,
  5: 0.24, 6: 0.28, 7: 0.45, 8: 0.58,
  9: 0.55, 10: 0.48, 11: 0.42, 12: 0.40,
};

// ── Biodiversity: endangered species weights ─────────────────────────────────
const CONSERVATION_WEIGHTS = {
  CRITICALLY_ENDANGERED: 4.0,
  ENDANGERED: 3.0,
  VULNERABLE: 2.0,
  NEAR_THREATENED: 1.5,
};

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function round2(value) {
  return Number((value ?? 0).toFixed(2));
}

// ── 1. Vegetation: seasonal-adjusted urban NDVI normalization ───────────────
function ndviToScore(ndvi, month) {
  if (typeof ndvi !== "number") return 0;
  const URBAN_MIN = 0.10; // bare/sparse vegetation
  const URBAN_MAX = 0.75; // dense urban forest canopy

  // Base score from absolute NDVI (0-100 scale)
  const absScore = ((ndvi - URBAN_MIN) / (URBAN_MAX - URBAN_MIN)) * 100;

  // Seasonal adjustment: bonus/penalty vs monthly baseline
  const m = month ?? new Date().getMonth() + 1;
  const baseline = DELHI_NDVI_SEASONAL[m] ?? 0.40;
  // Relative score: 1.0× at baseline, up to 1.3× if above, down to 0.7× if below
  const relativeFactor = clamp(0.7 + (ndvi / baseline) * 0.3, 0.7, 1.3);

  // Blend 70% absolute + 30% seasonal-relative
  const blended = 0.70 * absScore + 0.30 * (absScore * relativeFactor);
  return clamp(round2(blended));
}

// ── 2. Thermal: Heat Index (apparent temperature) + Gaussian comfort curve ──
function computeHeatIndex(tempC, relHumidity) {
  // Steadman's Heat Index approximation (metric version)
  const T = tempC;
  const R = Math.min(100, Math.max(0, relHumidity));
  if (T < 27) return T; // Heat index only meaningful above 27°C
  const hi =
    -8.78469475556 +
    1.61139411 * T +
    2.33854883889 * R -
    0.14611605 * T * R -
    0.012308094 * T * T -
    0.0164248277778 * R * R +
    0.002211732 * T * T * R +
    0.00072546 * T * R * R -
    0.000003582 * T * T * R * R;
  return round2(hi);
}

function thermalScoreFromHeatIndex(tempC, relHumidity) {
  if (typeof tempC !== "number") return 0;
  const apparentTemp = relHumidity != null
    ? computeHeatIndex(tempC, relHumidity)
    : tempC;
  // Gaussian bell curve: peak at 22°C, sigma=7.5
  const OPTIMAL = 22;
  const SIGMA = 7.5;
  const score = 100 * Math.exp(-0.5 * Math.pow((apparentTemp - OPTIMAL) / SIGMA, 2));
  return clamp(round2(score));
}

// ── 3. Water: soil moisture + drain health ─────────────────────────────────
function moistureToScore(moisture) {
  if (typeof moisture !== "number") return 0;
  if (moisture >= 40 && moisture <= 70) return 100;
  if (moisture < 40) return clamp((moisture / 40) * 100);
  if (moisture >= 100) return 0;
  return clamp(100 - ((moisture - 70) / 30) * 100);
}

// ── 4. Biodiversity: Shannon H + endangered species multiplier ──────────────
function shannonDiversityScore(logs) {
  if (!Array.isArray(logs) || logs.length === 0) return 0;

  const speciesMap = new Map();
  let total = 0;
  for (const log of logs) {
    const species = log.speciesName || "unknown";
    const baseCount = Number.isFinite(log.count) && log.count > 0 ? log.count : 1;
    const confidenceWeight = log.confidence != null ? log.confidence : 0.8;
    const conservationMultiplier = CONSERVATION_WEIGHTS[log.conservationStatus] ?? 1.0;
    const effectiveCount = baseCount * confidenceWeight * conservationMultiplier;

    speciesMap.set(species, (speciesMap.get(species) || 0) + effectiveCount);
    total += effectiveCount;
  }
  if (total <= 0) return 0;

  const counts = Array.from(speciesMap.values());
  const shannon = counts.reduce((acc, c) => {
    const p = c / total;
    return acc - p * Math.log(p);
  }, 0);

  const speciesCount = counts.length;
  if (speciesCount <= 1) return 10; // at least 1 species = minimal score
  const maxShannon = Math.log(speciesCount);
  const normalized = (shannon / maxShannon) * 100;

  // Bonus: species richness above 5 distinct species
  const richnesBonus = Math.min(15, (speciesCount - 5) * 2);
  return clamp(normalized + Math.max(0, richnesBonus));
}

// ── 5. Air Quality: PM2.5 + PM10 + CO2 ────────────────────────────────────
function airQualityToScore(pm25, pm10, co2) {
  // WHO guidelines: PM2.5 safe <15 μg/m³; PM10 safe <45; CO2 indoor safe <1000ppm
  const pm25Score = typeof pm25 === "number"
    ? clamp(100 - Math.max(0, pm25 - 5) * (100 / 40))  // 5→100%, 45→0%
    : null;
  const pm10Score = typeof pm10 === "number"
    ? clamp(100 - Math.max(0, pm10 - 10) * (100 / 80)) // 10→100%, 90→0%
    : null;
  const co2Score = typeof co2 === "number"
    ? clamp(100 - Math.max(0, co2 - 400) * (100 / 600)) // 400ppm→100%, 1000ppm→0%
    : null;

  const available = [pm25Score, pm10Score, co2Score].filter(s => s != null);
  if (available.length === 0) return 0;
  // Weighted: PM2.5 is most health-critical
  const weights = [0.5, 0.3, 0.2];
  const filled = [pm25Score ?? 60, pm10Score ?? 60, co2Score ?? 80]; // neutral fallbacks
  return round2(filled[0] * weights[0] + filled[1] * weights[1] + filled[2] * weights[2]);
}

// ── 6. Infrastructure: dynamic from sensor uptime + alerts + reports ────────
async function computeInfrastructureScore(parkId, db, previousScore) {
  try {
    const [totalNodes, onlineNodes, openAlerts, openReports] = await Promise.all([
      db.sensorNode.count({ where: { parkId } }),
      db.sensorNode.count({ where: { parkId, isActive: true, status: "ONLINE" } }),
      db.alert.count({ where: { parkId, status: { in: ["OPEN", "ASSIGNED", "ESCALATED"] } } }),
      db.citizenReport.count({
        where: {
          parkId,
          status: "PENDING",
          type: { in: ["TREE_DAMAGE", "VANDALISM", "FLOODING", "IRRIGATION_FAILURE"] },
        },
      }),
    ]);

    const uptimeScore = totalNodes > 0 ? (onlineNodes / totalNodes) * 100 : 70;
    const alertPenalty = Math.min(30, openAlerts * 5);   // -5pts per open alert, max -30
    const reportPenalty = Math.min(20, openReports * 4);  // -4pts per open report, max -20

    return clamp(round2(uptimeScore - alertPenalty - reportPenalty));
  } catch {
    return round2(previousScore ?? 70);
  }
}

// ── 7. Tree Health: recency-decay weighted average ──────────────────────────
function decayedTreeHealthScore(scans) {
  if (!Array.isArray(scans) || scans.length === 0) return 0;
  const HALF_LIFE_DAYS = 30;
  let weightedSum = 0;
  let totalWeight = 0;
  for (const scan of scans) {
    const daysAgo = (Date.now() - new Date(scan.scannedAt).getTime()) / (1000 * 60 * 60 * 24);
    const weight = Math.exp((-Math.LN2 * daysAgo) / HALF_LIFE_DAYS);
    weightedSum += (scan.aiHealthScore ?? 0) * weight;
    totalWeight += weight;
  }
  return totalWeight > 0 ? clamp(round2(weightedSum / totalWeight)) : 0;
}

// ── 8. Resilience: composite mitigation potential (Flood + Thermal + Ecological) ─
function calculateResilienceScore(subScores, floodRisk) {
  // 1. Flood Resilience (Inverted Flood Risk) - 30%
  // floodRisk is 0-1 (1 is high risk). If unknown, assume 0.5 (neutral)
  const floodMitigation = (1 - (floodRisk ?? 0.5)) * 100;

  // 2. Thermal Buffer (Canopy + Ambient) - 40%
  const thermalResilience = (subScores.vegetationScore * 0.6) + (subScores.thermalScore * 0.4);

  // 3. Ecological Stability (Biodiversity + Tree Health) - 30%
  const ecologicalStability = (subScores.biodiversityScore * 0.5) + (subScores.treeHealthScore * 0.5);

  const score = (floodMitigation * 0.3) + (thermalResilience * 0.4) + (ecologicalStability * 0.3);
  return round2(clamp(score));
}

function computeWeightedOverall(parts) {
  return round2(
    (parts.vegetationScore ?? 0) * WEIGHTS.vegetationScore +
    (parts.thermalScore ?? 0) * WEIGHTS.thermalScore +
    (parts.waterScore ?? 0) * WEIGHTS.waterScore +
    (parts.biodiversityScore ?? 0) * WEIGHTS.biodiversityScore +
    (parts.airQualityScore ?? 0) * WEIGHTS.airQualityScore +
    (parts.infrastructureScore ?? 0) * WEIGHTS.infrastructureScore +
    (parts.treeHealthScore ?? 0) * WEIGHTS.treeHealthScore,
  );
}

async function calculateGshi(parkId, options = {}) {
  const cacheKey = `gshi:v1:cache:${parkId}`;
  const CACHE_TTL = 6 * 60 * 60; // 6 hours

  try {
    if (!options.forceRefresh) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }
  } catch (err) {
    // continue if redis fails
  }

  const db = options.prismaClient || prisma;
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const park = await db.park.findUnique({
    where: { id: parkId },
    select: { id: true, cityId: true, name: true },
  });
  if (!park) {
    const err = new Error("Park not found");
    err.statusCode = 404;
    err.code = "NOT_FOUND";
    throw err;
  }

  const [latestSatellite, sensorAgg, biodiversityLogs, treeScans, previousGshi, floodRisk] = await Promise.all([
    db.satelliteImage.findFirst({
      where: { parkId },
      orderBy: { capturedAt: "desc" },
      select: { id: true, source: true, capturedAt: true, ndviMean: true },
    }),
    // Extended aggregate: now includes humidity + air quality sensors
    db.sensorReading.aggregate({
      where: {
        node: { parkId, isActive: true },
        timestamp: { gte: last24h },
      },
      _avg: {
        temperature: true,
        humidity: true,
        soilMoisture: true,
        airQualityPM25: true,
        airQualityPM10: true,
        co2Level: true,
      },
    }),
    // Biodiversity: now includes confidence + conservation status
    db.biodiversityLog.findMany({
      where: { parkId, detectedAt: { gte: last7d } },
      select: { speciesName: true, count: true, confidence: true, conservationStatus: true },
    }),
    // Tree scans: fetch individual records for recency decay
    db.treeScan.findMany({
      where: { parkId, aiHealthScore: { not: null } },
      orderBy: { scannedAt: "desc" },
      take: 20,
      select: { aiHealthScore: true, scannedAt: true },
    }),
    db.gshiScore.findFirst({
      where: { parkId },
      orderBy: { calculatedAt: "desc" },
      select: { id: true, overallScore: true, infrastructureScore: true },
    }),
    // Fetch latest flood risk for resilience calculation
    db.floodEvent.findFirst({
      where: { parkId },
      orderBy: { startedAt: "desc" },
      select: { peakWaterLevelCm: true, severity: true },
    }).then(f => {
      // Approximate risk from 0 to 1
      if (!f) return 0.2; // default low risk
      if (f.severity === "EMERGENCY") return 0.9;
      if (f.severity === "WARNING") return 0.6;
      return 0.3;
    }),
  ]);

  const currentMonth = now.getMonth() + 1;
  const ndviValue = latestSatellite?.ndviMean ?? null;
  const vegetationScore = round2(ndviToScore(ndviValue, currentMonth));
  const thermalScore = round2(thermalScoreFromHeatIndex(
    sensorAgg._avg.temperature,
    sensorAgg._avg.humidity,
  ));
  const waterScore = round2(moistureToScore(sensorAgg._avg.soilMoisture));
  const biodiversityScore = round2(shannonDiversityScore(biodiversityLogs));
  const airQualityScore = round2(airQualityToScore(
    sensorAgg._avg.airQualityPM25,
    sensorAgg._avg.airQualityPM10,
    sensorAgg._avg.co2Level,
  ));
  const treeHealthScore = round2(decayedTreeHealthScore(treeScans));
  const infrastructureScore = await computeInfrastructureScore(
    parkId, db,
    options.infrastructureScore ?? previousGshi?.infrastructureScore,
  );

  const subScores = {
    vegetationScore,
    thermalScore,
    waterScore,
    biodiversityScore,
    airQualityScore,
    infrastructureScore,
    treeHealthScore,
  };

  const resilienceScore = calculateResilienceScore(subScores, floodRisk);

  const overallScore = computeWeightedOverall(subScores);

  const saved = await db.gshiScore.create({
    data: {
      parkId,
      calculatedAt: now,
      overallScore,
      vegetationScore,
      thermalScore,
      waterScore,
      biodiversityScore,
      airQualityScore,
      infrastructureScore,
      treeHealthScore,
      resilienceScore,
      ndviValue,
      dataSourcesUsed: {
        satelliteImageId: latestSatellite?.id || null,
        satelliteSource: latestSatellite?.source || null,
        satelliteCapturedAt: latestSatellite?.capturedAt || null,
        sensorWindowStart: last24h.toISOString(),
        biodiversityWindowStart: last7d.toISOString(),
        seasonalMonth: currentMonth,
      },
    },
  });

  try {
    await redis.publish(
      `gshi:${parkId}`,
      JSON.stringify({
        parkId,
        cityId: park.cityId,
        score: {
          overallScore,
          vegetationScore,
          thermalScore,
          waterScore,
          biodiversityScore,
          airQualityScore,
          infrastructureScore,
          treeHealthScore,
          ndviValue,
          calculatedAt: saved.calculatedAt,
        },
      }),
    );
  } catch (_) {
    // non-fatal pub/sub error
  }

  await bumpVersion(parkVersionKey(parkId));
  await bumpVersion(cityVersionKey(park.cityId));

  let alertCreated = null;
  const scoreDrop = previousGshi ? previousGshi.overallScore - overallScore : 0;
  if (scoreDrop > 10) {
    alertCreated = await db.alert.create({
      data: {
        parkId,
        severity: "WARNING",
        type: "NDVI_DECLINE",
        title: `GSHI dropped by ${round2(scoreDrop)} points`,
        description: "Green Space Health Index dropped significantly compared with previous calculation",
        aiConfidence: clamp(scoreDrop / 20, 0, 1),
        status: "OPEN",
      },
    });
  }

  const result = {
    parkId,
    parkName: park.name,
    calculatedAt: saved.calculatedAt,
    overallScore,
    resilienceScore,
    vegetationScore,
    thermalScore,
    waterScore,
    biodiversityScore,
    airQualityScore,
    infrastructureScore,
    treeHealthScore,
    ndviValue,
    scoreDropFromLast: round2(scoreDrop),
    alertCreated,
  };

  try {
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
  } catch (_) {
    // non-fatal
  }

  return result;
}

async function getCurrentGshi(parkId) {
  return prisma.gshiScore.findFirst({
    where: { parkId },
    orderBy: { calculatedAt: "desc" },
  });
}

async function getGshiHistory(parkId, { from, to, interval }) {
  const map = { daily: "day", weekly: "week", monthly: "month" };
  const unit = map[interval] || "day";
  return prisma.$queryRawUnsafe(
    `
    SELECT
      date_trunc('${unit}', "calculatedAt") AS bucket,
      AVG("overallScore") AS "overallScore",
      AVG("vegetationScore") AS "vegetationScore",
      AVG("thermalScore") AS "thermalScore",
      AVG("waterScore") AS "waterScore",
      AVG("biodiversityScore") AS "biodiversityScore",
      AVG("airQualityScore") AS "airQualityScore",
      AVG("infrastructureScore") AS "infrastructureScore",
      AVG("treeHealthScore") AS "treeHealthScore",
      COUNT(*)::int AS count
    FROM "GshiScore"
    WHERE "parkId" = $1
      AND "calculatedAt" >= $2::timestamptz
      AND "calculatedAt" <= $3::timestamptz
    GROUP BY bucket
    ORDER BY bucket ASC
  `,
    parkId,
    from,
    to,
  );
}

async function getCityRankings(cityId) {
  const parks = await prisma.park.findMany({
    where: { cityId, isActive: true },
    select: { id: true, name: true },
  });

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const ranked = await Promise.all(
    parks.map(async (park) => {
      const [latest, previousWeek, alertCount] = await Promise.all([
        prisma.gshiScore.findFirst({
          where: { parkId: park.id },
          orderBy: { calculatedAt: "desc" },
          select: { overallScore: true, calculatedAt: true },
        }),
        prisma.gshiScore.findFirst({
          where: { parkId: park.id, calculatedAt: { lte: weekAgo } },
          orderBy: { calculatedAt: "desc" },
          select: { overallScore: true },
        }),
        prisma.alert.count({
          where: { parkId: park.id, status: { in: ["OPEN", "ASSIGNED", "ESCALATED"] } },
        }),
      ]);

      const score = latest?.overallScore ?? 0;
      const scoreChangeVsLastWeek = previousWeek ? round2(score - previousWeek.overallScore) : null;
      return { parkId: park.id, parkName: park.name, score, scoreChangeVsLastWeek, alertCount };
    }),
  );

  return ranked.sort((a, b) => b.score - a.score);
}

function linearRegression(points) {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0, r2: 0 };
  const sumX = points.reduce((a, p) => a + p.x, 0);
  const sumY = points.reduce((a, p) => a + p.y, 0);
  const meanX = sumX / n;
  const meanY = sumY / n;

  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - meanX) * (p.y - meanY);
    den += (p.x - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;

  const ssTot = points.reduce((acc, p) => acc + (p.y - meanY) ** 2, 0);
  const ssRes = points.reduce((acc, p) => {
    const pred = slope * p.x + intercept;
    return acc + (p.y - pred) ** 2;
  }, 0);
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  return { slope, intercept, r2: clamp(r2, 0, 1) };
}

async function getParkForecast(parkId) {
  const rows = await prisma.gshiScore.findMany({
    where: { parkId },
    orderBy: { calculatedAt: "asc" },
    take: 30,
    select: { calculatedAt: true, overallScore: true },
  });
  if (rows.length === 0) return [];

  const points = rows.map((r, i) => ({ x: i, y: Number(r.overallScore) }));
  const { slope, intercept, r2 } = linearRegression(points);
  const confidence = round2(clamp(r2 * 100));
  const lastDate = new Date(rows[rows.length - 1].calculatedAt);

  const forecast = [];
  for (let i = 1; i <= 7; i += 1) {
    const x = points.length - 1 + i;
    const predictedScore = round2(clamp(slope * x + intercept));
    const date = new Date(lastDate);
    date.setDate(date.getDate() + i);
    forecast.push({ date: date.toISOString(), predictedScore, confidence });
  }
  return forecast;
}

async function getCityAverage(cityId) {
  const parks = await prisma.park.findMany({
    where: { cityId, isActive: true },
    select: { id: true, name: true },
  });
  if (parks.length === 0) {
    return { cityId, parkCount: 0, averageGshi: null, breakdown: null, trend: null };
  }

  const latestByPark = await Promise.all(
    parks.map((park) =>
      prisma.gshiScore.findFirst({
        where: { parkId: park.id },
        orderBy: { calculatedAt: "desc" },
      }),
    ),
  );

  const valid = latestByPark.filter(Boolean);
  if (valid.length === 0) {
    return { cityId, parkCount: parks.length, averageGshi: null, breakdown: null, trend: null };
  }

  const avg = (field) => round2(valid.reduce((sum, r) => sum + (r[field] ?? 0), 0) / valid.length);
  const averageGshi = avg("overallScore");
  const breakdown = {
    vegetationScore: avg("vegetationScore"),
    thermalScore: avg("thermalScore"),
    waterScore: avg("waterScore"),
    biodiversityScore: avg("biodiversityScore"),
    airQualityScore: avg("airQualityScore"),
    infrastructureScore: avg("infrastructureScore"),
    treeHealthScore: avg("treeHealthScore"),
  };

  const now = new Date();
  const prevFrom = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const prevTo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const prevRows = await prisma.gshiScore.findMany({
    where: { parkId: { in: parks.map((p) => p.id) }, calculatedAt: { gte: prevFrom, lte: prevTo } },
    select: { overallScore: true },
  });
  const prevAvg =
    prevRows.length > 0
      ? round2(prevRows.reduce((sum, r) => sum + (r.overallScore ?? 0), 0) / prevRows.length)
      : null;

  return {
    cityId,
    parkCount: parks.length,
    averageGshi,
    breakdown,
    trend:
      prevAvg === null
        ? null
        : { previousAverage: prevAvg, change: round2(averageGshi - prevAvg) },
  };
}

module.exports = {
  calculateGshi,
  getCurrentGshi,
  getGshiHistory,
  getCityRankings,
  getParkForecast,
  getCityAverage,
  __private: {
    ndviToScore,
    thermalScoreFromHeatIndex,
    moistureToScore,
    shannonDiversityScore,
    airQualityToScore,
    decayedTreeHealthScore,
    computeWeightedOverall,
  },
};
