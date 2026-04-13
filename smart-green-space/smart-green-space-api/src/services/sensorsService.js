const { prisma } = require("../config/prisma");
const { redis } = require("../config/redis");
const { getPagination, buildPaginatedResponse } = require("../utils/pagination");
const { createAlert } = require("./alertService");
const { bumpVersion, parkVersionKey, cityVersionKey } = require("../utils/cache");

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function computeZScore(current, samples) {
  if (!Number.isFinite(current) || samples.length < 10) return 0;
  const mean = samples.reduce((sum, v) => sum + v, 0) / samples.length;
  const variance = samples.reduce((sum, v) => sum + (v - mean) ** 2, 0) / samples.length;
  const std = Math.sqrt(variance);
  if (std === 0) return 0;
  return Math.abs((current - mean) / std);
}

async function listSensors(query) {
  const { page, limit, parkId, zoneId, status } = query;
  const { skip, take } = getPagination({ page, limit });
  const where = {
    ...(parkId ? { parkId } : {}),
    ...(zoneId ? { zoneId } : {}),
    ...(status ? { status } : {}),
    isActive: true,
  };

  const [total, nodes] = await Promise.all([
    prisma.sensorNode.count({ where }),
    prisma.sensorNode.findMany({
      where,
      skip,
      take,
      orderBy: { nodeCode: "asc" },
      include: {
        readings: {
          orderBy: { timestamp: "desc" },
          take: 1,
        },
      },
    }),
  ]);

  const items = nodes.map((node) => ({
    ...node,
    latestReading: node.readings[0] || null,
    readings: undefined,
  }));

  return buildPaginatedResponse({ items, total, page, limit });
}

async function getSensorNode(nodeId) {
  const node = await prisma.sensorNode.findUnique({
    where: { id: nodeId },
    include: {
      readings: {
        orderBy: { timestamp: "desc" },
        take: 60,
      },
      park: { select: { id: true, name: true, cityId: true } },
      zone: { select: { id: true, name: true, zoneCode: true } },
    },
  });
  return node;
}

async function createSensorNode(data) {
  return prisma.sensorNode.create({
    data: {
      ...data,
      status: "ONLINE",
      lastPingAt: new Date(),
      isActive: true,
    },
  });
}

async function updateSensorNode(nodeId, data) {
  return prisma.sensorNode.update({
    where: { id: nodeId },
    data,
  });
}

async function createSensorReading(nodeId, payload) {
  const node = await prisma.sensorNode.findUnique({ where: { id: nodeId } });
  if (!node || !node.isActive) return null;

  const recent = await prisma.sensorReading.findMany({
    where: { nodeId },
    orderBy: { timestamp: "desc" },
    take: 100,
    select: {
      soilMoisture: true,
      temperature: true,
      humidity: true,
      airQualityPM25: true,
      airQualityPM10: true,
      co2Level: true,
      lightIntensity: true,
      windSpeed: true,
    },
  });

  const metrics = [
    "soilMoisture",
    "temperature",
    "humidity",
    "airQualityPM25",
    "airQualityPM10",
    "co2Level",
    "lightIntensity",
    "windSpeed",
  ];

  let maxZ = 0;
  for (const metric of metrics) {
    if (typeof payload[metric] !== "number") continue;
    const samples = recent
      .map((r) => r[metric])
      .filter((v) => typeof v === "number" && Number.isFinite(v));
    const z = computeZScore(payload[metric], samples);
    if (z > maxZ) maxZ = z;
  }

  const anomalyScore = clamp01(maxZ / 4);
  const anomalyDetected = maxZ >= 2;
  const shouldCreateAlert = anomalyDetected && anomalyScore > 0.85;

  let alertCreated = null;
  const reading = await prisma.sensorReading.create({
    data: {
      nodeId,
      timestamp: new Date(),
      ...payload,
      isAnomaly: anomalyDetected,
      anomalyScore,
      anomalyType: anomalyDetected ? "Z_SCORE_OUTLIER" : null,
    },
  });

  if (shouldCreateAlert) {
    alertCreated = await createAlert({
      parkId: node.parkId,
      nodeId: node.id,
      severity: "WARNING",
      type: "SENSOR_OFFLINE",
      title: `Anomaly detected for ${node.nodeCode}`,
      description: "Sensor reading anomaly detected using Z-score analysis",
      aiConfidence: anomalyScore,
    });
  }

  await prisma.sensorNode.update({
    where: { id: nodeId },
    data: { lastPingAt: new Date(), status: anomalyDetected ? "ALERT" : "ONLINE" },
  });

  const eventPayload = {
    type: "sensor.reading.created",
    nodeId,
    parkId: node.parkId,
    readingId: reading.id,
    anomalyDetected,
    alertId: alertCreated?.id || null,
    timestamp: reading.timestamp,
  };
  try {
    await redis.publish("sgs:sensor-readings", JSON.stringify(eventPayload));
  } catch (_) {
    // non-fatal pub/sub error
  }

  try {
    const park = await prisma.park.findUnique({ where: { id: node.parkId }, select: { cityId: true } });
    await bumpVersion(parkVersionKey(node.parkId));
    if (park?.cityId) await bumpVersion(cityVersionKey(park.cityId));
  } catch (_) {
    // ignore cache invalidation errors
  }

  return { reading, anomalyDetected, alertCreated };
}

async function getAggregatedReadings(nodeId, { from, to, interval }) {
  const intervals = {
    "1min": "1 minute",
    "5min": "5 minutes",
    "1hour": "1 hour",
    "1day": "1 day",
  };
  const bucket = intervals[interval];

  const rows = await prisma.$queryRawUnsafe(
    `
    SELECT
      time_bucket($1::interval, "timestamp") AS bucket,
      AVG("soilMoisture") AS "avgSoilMoisture",
      AVG("temperature") AS "avgTemperature",
      AVG("humidity") AS "avgHumidity",
      AVG("airQualityPM25") AS "avgAirQualityPM25",
      AVG("airQualityPM10") AS "avgAirQualityPM10",
      AVG("co2Level") AS "avgCo2Level",
      AVG("lightIntensity") AS "avgLightIntensity",
      AVG("windSpeed") AS "avgWindSpeed",
      COUNT(*)::int AS count
    FROM "SensorReading"
    WHERE "nodeId" = $2
      AND "timestamp" >= $3::timestamptz
      AND "timestamp" <= $4::timestamptz
    GROUP BY bucket
    ORDER BY bucket ASC
  `,
    bucket,
    nodeId,
    from,
    to,
  );

  return rows;
}

async function getLatestReading(nodeId) {
  return prisma.sensorReading.findFirst({
    where: { nodeId },
    orderBy: { timestamp: "desc" },
  });
}

async function softDeleteSensor(nodeId) {
  return prisma.sensorNode.update({
    where: { id: nodeId },
    data: { isActive: false, status: "OFFLINE" },
  });
}

module.exports = {
  listSensors,
  getSensorNode,
  createSensorNode,
  updateSensorNode,
  createSensorReading,
  getAggregatedReadings,
  getLatestReading,
  softDeleteSensor,
};
