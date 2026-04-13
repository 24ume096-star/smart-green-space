const { prisma } = require("../config/prisma");
const { getPagination, buildPaginatedResponse } = require("../utils/pagination");

async function listParks(query) {
  const { page, limit, search, cityId, type, isActive } = query;
  const { skip, take } = getPagination({ page, limit });

  const where = {
    ...(cityId ? { cityId } : {}),
    ...(type ? { type } : {}),
    ...(typeof isActive === "boolean" ? { isActive } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { city: { name: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [total, parks] = await Promise.all([
    prisma.park.count({ where }),
    prisma.park.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        city: { select: { id: true, name: true, state: true, country: true } },
        gshiScores: {
          select: { calculatedAt: true, overallScore: true },
          orderBy: { calculatedAt: "desc" },
          take: 1,
        },
      },
    }),
  ]);

  const items = parks.map((park) => ({
    ...park,
    latestGshi: park.gshiScores[0] || null,
    gshiScores: undefined,
  }));

  return buildPaginatedResponse({ items, total, page, limit });
}

async function getParkById(parkId) {
  const park = await prisma.park.findUnique({
    where: { id: parkId },
    include: {
      city: true,
      gshiScores: { orderBy: { calculatedAt: "desc" }, take: 1 },
      _count: { select: { sensorNodes: true } },
    },
  });
  if (!park) return null;

  const [activeAlertCount, latestSatellite] = await Promise.all([
    prisma.alert.count({
      where: { parkId, status: { in: ["OPEN", "ASSIGNED", "ESCALATED"] } },
    }),
    prisma.satelliteImage.findFirst({
      where: { parkId },
      orderBy: { capturedAt: "desc" },
      select: { capturedAt: true },
    }),
  ]);

  return {
    ...park,
    latestGshi: park.gshiScores[0] || null,
    activeAlertCount,
    sensorNodeCount: park._count.sensorNodes,
    lastSatelliteImageDate: latestSatellite?.capturedAt || null,
    gshiScores: undefined,
    _count: undefined,
  };
}

async function createPark(data) {
  return prisma.park.create({
    data,
  });
}

async function updatePark(parkId, data) {
  return prisma.park.update({
    where: { id: parkId },
    data,
  });
}

async function listParkZones(parkId) {
  return prisma.irrigationZone.findMany({
    where: { parkId },
    orderBy: { name: "asc" },
  });
}

async function parkStatsSummary(parkId) {
  const [
    totalTrees,
    healthyTrees,
    atRiskTrees,
    criticalTrees,
    totalSensors,
    onlineSensors,
    offlineSensors,
    openAlerts,
    resolvedAlerts,
    readingAgg,
    irrigationEvents,
    speciesDistinct,
    endangeredCount,
  ] = await Promise.all([
    prisma.tree.count({ where: { parkId } }),
    prisma.tree.count({ where: { parkId, healthStatus: "HEALTHY" } }),
    prisma.tree.count({ where: { parkId, healthStatus: "AT_RISK" } }),
    prisma.tree.count({ where: { parkId, healthStatus: { in: ["CRITICAL", "DEAD"] } } }),
    prisma.sensorNode.count({ where: { parkId, isActive: true } }),
    prisma.sensorNode.count({ where: { parkId, isActive: true, status: "ONLINE" } }),
    prisma.sensorNode.count({ where: { parkId, isActive: true, status: "OFFLINE" } }),
    prisma.alert.count({ where: { parkId, status: { in: ["OPEN", "ASSIGNED", "ESCALATED"] } } }),
    prisma.alert.count({ where: { parkId, status: "RESOLVED" } }),
    prisma.sensorReading.aggregate({
      where: {
        node: { parkId },
      },
      _avg: { soilMoisture: true, temperature: true },
    }),
    prisma.irrigationEvent.aggregate({
      where: {
        zone: { parkId },
        triggeredAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
      _sum: { waterUsedLiters: true },
    }),
    prisma.biodiversityLog.findMany({
      where: { parkId },
      distinct: ["speciesName"],
      select: { speciesName: true },
    }),
    prisma.biodiversityLog.count({ where: { parkId, isEndangered: true } }),
  ]);

  const waterUsedThisMonth = irrigationEvents._sum.waterUsedLiters || 0;
  const waterSavedVsManual = Number((waterUsedThisMonth * 0.2).toFixed(2));
  const speciesCount = speciesDistinct.length;
  const biodiversityIndex = Math.min(100, Number((speciesCount * 8 + endangeredCount * 4).toFixed(2)));

  return {
    totalTrees,
    healthyTrees,
    atRiskTrees,
    criticalTrees,
    totalSensors,
    onlineSensors,
    offlineSensors,
    openAlerts,
    resolvedAlerts,
    avgSoilMoisture: readingAgg._avg.soilMoisture,
    avgTemperature: readingAgg._avg.temperature,
    waterUsedThisMonth,
    waterSavedVsManual,
    speciesCount,
    biodiversityIndex,
  };
}

module.exports = {
  listParks,
  getParkById,
  createPark,
  updatePark,
  listParkZones,
  parkStatsSummary,
};
