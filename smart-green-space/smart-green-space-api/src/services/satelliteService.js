const crypto = require("crypto");
const { prisma } = require("../config/prisma");
const { calculateGshi } = require("./gshiService");
const { uploadBufferToS3 } = require("../middleware/upload");
const { s3Enabled } = require("../config/aws");
const { env } = require("../config/env");
const { logger } = require("../utils/logger");
const { satelliteIngestQueue } = require("../config/queue");
const { bumpVersion, parkVersionKey, cityVersionKey } = require("../utils/cache");
const { analyzePhenologyForPark } = require("./phenologyService");

/** Minimal valid 1×1 PNG — used as NDVI map placeholder payload for S3. */
const NDVI_PLACEHOLDER_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function round2(n) {
  return Number((n ?? 0).toFixed(2));
}

function hashParkIdToSeed(parkId) {
  const h = crypto.createHash("sha256").update(parkId).digest();
  return h.readUInt32BE(0);
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a += 0x6d2b79f5;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Development / test NDVI pixel field — seasonal swing + noise + occasional stress patches.
 * @returns {{ pixels: number[], capturedAt: Date, source: 'SENTINEL2', thermalMeanC: number }}
 */
function generateMockNdviData(parkId) {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now - start) / 86400000);
  const seasonal = 0.12 * Math.sin((dayOfYear / 365) * Math.PI * 2);
  const rand = mulberry32(hashParkIdToSeed(parkId) ^ (dayOfYear * 9973));
  const n = 2400;
  const pixels = [];
  for (let i = 0; i < n; i += 1) {
    const noise = (rand() - 0.5) * 0.14;
    let v = 0.44 + seasonal + noise;
    if (rand() < 0.07) v -= 0.22 + rand() * 0.15;
    v = clamp(v, -0.15, 0.88);
    pixels.push(v);
  }

  const thermalMeanC = round2(28 + rand() * 14 + (1 - seasonal) * 2);

  return {
    pixels,
    capturedAt: now,
    source: "SENTINEL2",
    thermalMeanC,
  };
}

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}

function stdDev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const v = mean(arr.map((x) => (x - m) ** 2));
  return Math.sqrt(v);
}

/**
 * Zone thresholds on NDVI [-1, 1]: bare &lt; 0.2, stressed 0.2–0.5, healthy &gt; 0.5
 */
function classifyNdviZones(pixels) {
  if (!pixels.length) {
    return { healthy: 0, stressed: 0, bare: 0 };
  }
  let h = 0;
  let s = 0;
  let b = 0;
  for (const p of pixels) {
    if (p > 0.5) h += 1;
    else if (p >= 0.2) s += 1;
    else b += 1;
  }
  const n = pixels.length;
  return {
    healthy: round2((h / n) * 100),
    stressed: round2((s / n) * 100),
    bare: round2((b / n) * 100),
  };
}

function synthesizePixelsFromStats(ndviMean, ndviMin, ndviMax) {
  const r = mulberry32(hashParkIdToSeed(String(ndviMean)) ^ 0x9e3779b9);
  const lo = typeof ndviMin === "number" ? ndviMin : ndviMean - 0.08;
  const hi = typeof ndviMax === "number" ? ndviMax : ndviMean + 0.08;
  const pixels = [];
  for (let i = 0; i < 800; i += 1) {
    pixels.push(clamp(ndviMean + (r() - 0.5) * (hi - lo + 0.01), -0.2, 0.95));
  }
  return pixels;
}

function normalizeRawNdviInput(rawNdviData) {
  if (Array.isArray(rawNdviData)) {
    return { pixels: rawNdviData, precomputed: null };
  }
  if (rawNdviData && typeof rawNdviData === "object") {
    if (Array.isArray(rawNdviData.pixels)) {
      return { pixels: rawNdviData.pixels, precomputed: rawNdviData.precomputed || null };
    }
    if (
      typeof rawNdviData.ndviMean === "number" ||
      typeof rawNdviData.ndviMin === "number" ||
      typeof rawNdviData.ndviMax === "number" ||
      typeof rawNdviData.ndviStdDev === "number"
    ) {
      const m = rawNdviData.ndviMean ?? 0.4;
      const pixels = synthesizePixelsFromStats(m, rawNdviData.ndviMin, rawNdviData.ndviMax);
      return {
        pixels,
        precomputed: {
          ndviMean: rawNdviData.ndviMean,
          ndviMin: rawNdviData.ndviMin,
          ndviMax: rawNdviData.ndviMax,
          ndviStdDev: rawNdviData.ndviStdDev,
        },
      };
    }
  }
  const err = new Error("Invalid NDVI input: expected number[], { pixels }, or { ndviMean, ... }");
  err.statusCode = 400;
  err.code = "INVALID_NDVI_INPUT";
  throw err;
}

async function uploadNdviMapAsset({ parkId, capturedAt }) {
  const key = `satellite/ndvi/${parkId}/${capturedAt.getTime()}.png`;
  if (s3Enabled) {
    try {
      const { url } = await uploadBufferToS3({
        buffer: NDVI_PLACEHOLDER_PNG,
        contentType: "image/png",
        key,
      });
      return url;
    } catch (err) {
      logger.warn("satellite_ndvi_s3_upload_failed", { parkId, err: err.message });
    }
  }
  const base =
    env.NODE_ENV === "production"
      ? "https://satellite.smartgreenspace.io/mock"
      : "http://localhost:8080/mock/satellite";
  return `${base}/ndvi/${parkId}/${capturedAt.getTime()}.png`;
}

async function maybeCreateNdviDropAlert(parkId, capturedAt, newNdviMean) {
  if (typeof newNdviMean !== "number" || !Number.isFinite(newNdviMean)) return null;

  const prev = await prisma.satelliteImage.findFirst({
    where: { parkId, capturedAt: { lt: capturedAt } },
    orderBy: { capturedAt: "desc" },
  });

  if (!prev || typeof prev.ndviMean !== "number" || prev.ndviMean < 0.05) return null;

  const dropRatio = (prev.ndviMean - newNdviMean) / Math.abs(prev.ndviMean);
  if (dropRatio <= 0.15) return null;

  const open = await prisma.alert.findFirst({
    where: {
      parkId,
      type: "NDVI_DECLINE",
      status: { in: ["OPEN", "ASSIGNED", "ESCALATED"] },
    },
  });
  if (open) return null;

  return prisma.alert.create({
    data: {
      parkId,
      severity: dropRatio > 0.35 ? "CRITICAL" : "WARNING",
      type: "NDVI_DECLINE",
      title: `NDVI declined ${round2(dropRatio * 100)}% vs previous capture`,
      description: `Mean NDVI dropped from ${round2(prev.ndviMean)} to ${round2(newNdviMean)} since the prior satellite pass.`,
      aiConfidence: clamp(dropRatio, 0, 1),
      status: "OPEN",
    },
  });
}

/**
 * @param {string} parkId
 * @param {number[]|object} rawNdviData
 * @param {object} [options]
 * @param {Date} [options.capturedAt]
 * @param {import('@prisma/client').SatelliteSource} [options.source]
 * @param {number} [options.cloudCoverage]
 * @param {string} [options.thermalMapUrl]
 * @param {number} [options.thermalMeanC]
 */
async function processNdviImage(parkId, rawNdviData, options = {}) {
  const park = await prisma.park.findUnique({
    where: { id: parkId },
    select: { id: true, name: true, isActive: true, cityId: true },
  });
  if (!park) {
    const err = new Error("Park not found");
    err.statusCode = 404;
    err.code = "NOT_FOUND";
    throw err;
  }
  if (!park.isActive) {
    const err = new Error("Park is not active");
    err.statusCode = 400;
    err.code = "PARK_INACTIVE";
    throw err;
  }

  const capturedAt = options.capturedAt ? new Date(options.capturedAt) : new Date();
  const source = options.source || "SENTINEL2";

  const { pixels, precomputed } = normalizeRawNdviInput(rawNdviData);

  let ndviMean = precomputed?.ndviMean != null ? precomputed.ndviMean : mean(pixels);
  let ndviMin = precomputed?.ndviMin != null ? precomputed.ndviMin : Math.min(...pixels);
  let ndviMax = precomputed?.ndviMax != null ? precomputed.ndviMax : Math.max(...pixels);
  let ndviStdDev =
    precomputed?.ndviStdDev != null ? precomputed.ndviStdDev : round2(stdDev(pixels));

  ndviMean = round2(ndviMean);
  ndviMin = round2(ndviMin);
  ndviMax = round2(ndviMax);

  const ndviZones = classifyNdviZones(pixels);

  const ndviMapUrl =
    options.ndviMapUrl ?? (await uploadNdviMapAsset({ parkId, capturedAt }));
  const imageUrl = options.imageUrl ?? ndviMapUrl;

  const thermalMeanC =
    typeof options.thermalMeanC === "number" && Number.isFinite(options.thermalMeanC)
      ? round2(options.thermalMeanC)
      : null;

  const record = await prisma.satelliteImage.create({
    data: {
      parkId,
      capturedAt,
      source,
      imageUrl,
      ndviMapUrl,
      thermalMapUrl: options.thermalMapUrl ?? null,
      cloudCoverage:
        typeof options.cloudCoverage === "number" ? clamp(options.cloudCoverage, 0, 100) : null,
      ndviMean,
      ndviMin,
      ndviMax,
      ndviStdDev,
      ndviZones,
      thermalMeanC,
      processedAt: new Date(),
    },
  });

  let gshiResult;
  try {
    gshiResult = await calculateGshi(parkId);
  } catch (e) {
    logger.error("satellite_gshi_recalc_failed", { parkId, err: e.message });
  }

  let ndviAlert;
  try {
    ndviAlert = await maybeCreateNdviDropAlert(parkId, capturedAt, ndviMean);
  } catch (e) {
    logger.warn("satellite_ndvi_alert_failed", { parkId, err: e.message });
  }

  // Final step: Update Phenology seasonal log
  try {
    await analyzePhenologyForPark(parkId);
  } catch (e) {
    logger.warn("phenology_analysis_failed", { parkId, err: e.message });
  }

  await bumpVersion(parkVersionKey(parkId));
  await bumpVersion(cityVersionKey(park.cityId));

  return {
    satelliteImage: record,
    stats: {
      ndviMean,
      ndviMin,
      ndviMax,
      ndviStdDev,
      ndviZones,
    },
    ndviMapUrl,
    gshi: gshiResult || null,
    ndviAlert: ndviAlert || null,
  };
}

async function getLatestForPark(parkId) {
  const row = await prisma.satelliteImage.findFirst({
    where: { parkId },
    orderBy: { capturedAt: "desc" },
    include: { park: { select: { id: true, name: true, cityId: true } } },
  });
  return row;
}

async function getHistoryForPark(parkId, { from, to }) {
  const rows = await prisma.satelliteImage.findMany({
    where: {
      parkId,
      capturedAt: { gte: from, lte: to },
    },
    orderBy: { capturedAt: "asc" },
    select: {
      id: true,
      capturedAt: true,
      source: true,
      imageUrl: true,
      ndviMapUrl: true,
      thermalMapUrl: true,
      cloudCoverage: true,
      ndviMean: true,
      ndviMin: true,
      ndviMax: true,
      ndviStdDev: true,
      ndviZones: true,
      thermalMeanC: true,
      processedAt: true,
    },
  });

  const trend = rows.map((r, i) => ({
    ...r,
    ndviDeltaFromPrev:
      i > 0 && typeof r.ndviMean === "number" && typeof rows[i - 1].ndviMean === "number"
        ? round2(r.ndviMean - rows[i - 1].ndviMean)
        : null,
  }));

  return trend;
}

async function manualIngest(parkId, body) {
  const {
    capturedAt,
    source,
    ndviMean,
    ndviMin,
    ndviMax,
    ndviMapUrl,
    thermalMapUrl,
    cloudCoverage,
    thermalMeanC,
    imageUrl,
  } = body;

  return processNdviImage(
    parkId,
    {
      ndviMean,
      ndviMin,
      ndviMax,
    },
    {
      capturedAt,
      source: source || "SENTINEL2",
      ndviMapUrl,
      thermalMapUrl,
      cloudCoverage,
      thermalMeanC,
      imageUrl,
    },
  );
}

async function getNdviTimeseries(parkId, { from, to, interval }) {
  const unit = interval === "monthly" ? "month" : "week";
  return prisma.$queryRawUnsafe(
    `
    SELECT
      date_trunc('${unit}', "capturedAt") AS bucket,
      AVG("ndviMean")::float AS "ndviMean",
      MIN("ndviMin")::float AS "ndviMin",
      MAX("ndviMax")::float AS "ndviMax",
      COUNT(*)::int AS count
    FROM "SatelliteImage"
    WHERE "parkId" = $1
      AND "capturedAt" >= $2::timestamptz
      AND "capturedAt" <= $3::timestamptz
      AND "ndviMean" IS NOT NULL
    GROUP BY bucket
    ORDER BY bucket ASC
  `,
    parkId,
    from,
    to,
  );
}

async function getCityThermalZones(cityId) {
  const parks = await prisma.park.findMany({
    where: { cityId, isActive: true },
    select: { id: true, name: true, lat: true, lng: true },
  });

  const items = await Promise.all(
    parks.map(async (park) => {
      const latest = await prisma.satelliteImage.findFirst({
        where: { parkId: park.id, thermalMeanC: { not: null } },
        orderBy: { capturedAt: "desc" },
        select: {
          id: true,
          capturedAt: true,
          thermalMeanC: true,
          thermalMapUrl: true,
          cloudCoverage: true,
        },
      });

      const t = latest?.thermalMeanC;
      let heatIslandLevel = "UNKNOWN";
      if (typeof t === "number") {
        if (t >= 38) heatIslandLevel = "HIGH";
        else if (t >= 33) heatIslandLevel = "ELEVATED";
        else if (t >= 28) heatIslandLevel = "MODERATE";
        else heatIslandLevel = "LOW";
      }

      return {
        parkId: park.id,
        parkName: park.name,
        lat: park.lat,
        lng: park.lng,
        latestThermal: latest,
        heatIslandLevel,
        hasThermalData: Boolean(latest),
      };
    }),
  );

  const withData = items.filter((i) => i.hasThermalData);
  const avgThermal =
    withData.length > 0
      ? round2(
          withData.reduce((s, i) => s + (i.latestThermal.thermalMeanC || 0), 0) / withData.length,
        )
      : null;

  return {
    cityId,
    parkCount: parks.length,
    parksWithThermalImagery: withData.length,
    averageThermalMeanC: avgThermal,
    parks: items,
  };
}

function verifySentinelWebhookSignature(rawBuffer, signatureHeader) {
  const secret = env.SENTINEL_WEBHOOK_SECRET;
  if (!secret) {
    if (env.NODE_ENV === "development" || env.NODE_ENV === "test") {
      return;
    }
    const err = new Error("SENTINEL_WEBHOOK_SECRET is not configured");
    err.statusCode = 500;
    throw err;
  }
  if (!signatureHeader || typeof signatureHeader !== "string") {
    const err = new Error("Missing webhook signature");
    err.statusCode = 401;
    throw err;
  }
  const expected = crypto.createHmac("sha256", secret).update(rawBuffer).digest("hex");
  const provided = signatureHeader.replace(/^sha256=/, "").trim();
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(provided, "hex");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new Error("mismatch");
    }
  } catch {
    const err = new Error("Invalid webhook signature");
    err.statusCode = 401;
    throw err;
  }
}

async function enqueueSentinelWebhookPayload(payload) {
  await satelliteIngestQueue.add(
    "sentinel-webhook",
    { payload },
    { removeOnComplete: 50, attempts: 3 },
  );
}

/**
 * Production hook: fetch Sentinel-2 / Copernicus — placeholder until integrated.
 */
async function fetchCopernicusSceneForPark(parkId) {
  logger.info("copernicus_fetch_stub", { parkId, message: "Integrate OData / STAC when credentialed" });
  return null;
}

async function runScheduledIngest() {
  const parks = await prisma.park.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  const results = { processed: 0, failed: 0, skipped: 0 };

  for (const p of parks) {
    try {
      if (env.NODE_ENV === "development" || process.env.MOCK_SATELLITE === "1") {
        const mock = generateMockNdviData(p.id);
        await processNdviImage(p.id, mock.pixels, {
          capturedAt: mock.capturedAt,
          source: mock.source,
          thermalMeanC: mock.thermalMeanC,
          cloudCoverage: round2(Math.random() * 35),
        });
        results.processed += 1;
        continue;
      }

      const scene = await fetchCopernicusSceneForPark(p.id);
      if (!scene) {
        results.skipped += 1;
        continue;
      }
      await processNdviImage(p.id, scene.pixels, {
        capturedAt: scene.capturedAt,
        source: scene.source || "SENTINEL2",
        thermalMeanC: scene.thermalMeanC,
        cloudCoverage: scene.cloudCoverage,
      });
      results.processed += 1;
    } catch (e) {
      logger.error("scheduled_satellite_ingest_park_failed", { parkId: p.id, err: e.message });
      results.failed += 1;
    }
  }

  return results;
}

module.exports = {
  generateMockNdviData,
  processNdviImage,
  getLatestForPark,
  getHistoryForPark,
  manualIngest,
  getNdviTimeseries,
  getCityThermalZones,
  verifySentinelWebhookSignature,
  enqueueSentinelWebhookPayload,
  runScheduledIngest,
  fetchCopernicusSceneForPark,
};
