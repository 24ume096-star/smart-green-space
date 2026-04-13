const { prisma } = require("../config/prisma");
const { cacheAsideJson, getVersion, parkVersionKey } = require("../utils/cache");

/**
 * Calculate carbon sequestration and emissions metrics for a park
 * @param {string} parkId - The park ID
 * @returns {Promise<Object>} Carbon statistics
 */
async function calculateParkCarbon(parkId) {
  const cacheKey = `carbon:${parkId}`;
  const versionKey = parkVersionKey(parkId);

  // Try to get from cache
  const cached = await cacheAsideJson(cacheKey, versionKey, async () => {
    return await calculateParkCarbonRaw(parkId);
  });

  return cached;
}

async function calculateParkCarbonRaw(parkId) {
  // Validate park exists
  const park = await prisma.park.findUnique({ where: { id: parkId } });
  if (!park) {
    throw new Error(`Park not found: ${parkId}`);
  }

  const now = new Date();
  const from30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Get biodiversity and vegetation data
  const [biodiversityData, satelliteData, treeCanopyData] = await Promise.all([
    prisma.biodiversityLog.findMany({
      where: { parkId, observedAt: { gte: from30d } },
      select: { speciesName: true, count: true, observedAt: true },
    }),
    prisma.satelliteImage.findMany({
      where: { parkId, capturedAt: { gte: from30d } },
      select: { ndviMean: true, capturedAt: true, source: true },
      orderBy: { capturedAt: "desc" },
      take: 12,
    }),
    prisma.gshiScore.findMany({
      where: { parkId, calculatedAt: { gte: from30d } },
      select: { vegetationIndex: true, calculatedAt: true },
      orderBy: { calculatedAt: "desc" },
      take: 30,
    }),
  ]);

  // Calculate carbon metrics
  const ndviValues = satelliteData.map((s) => Number(s.ndviMean ?? 0)).filter((n) => Number.isFinite(n));
  const avgNdvi = ndviValues.length > 0 ? ndviValues.reduce((a, b) => a + b, 0) / ndviValues.length : 0;

  // NDVI to carbon dioxide absorption (simplified)
  // Higher NDVI = more vegetation = more CO2 absorption
  // Assumption: 1 hectare of forest absorbs ~2.5 tonnes CO2/year
  const parkAreaHa = (park.areaM2 || 0) / 10000;
  const leafAreaIndex = Math.max(0, (avgNdvi + 1) / 2); // Normalize NDVI to 0-1
  const annualCo2SequestrationTonnes = parkAreaHa * 2.5 * leafAreaIndex;

  // Biodiversity carbon value (species count)
  const uniqueSpecies = new Set(biodiversityData.map((b) => b.speciesName)).size;
  const speciesCarbon = uniqueSpecies * 0.1; // 0.1 tonnes per species as proxy

  // Tree canopy coverage from vegetation index
  const vegIndexValues = treeCanopyData.map((t) => Number(t.vegetationIndex ?? 0)).filter((n) => Number.isFinite(n));
  const avgVegIndex = vegIndexValues.length > 0 ? vegIndexValues.reduce((a, b) => a + b, 0) / vegIndexValues.length : 0;
  const treeCanopyCoverage = Math.min(100, avgVegIndex * 100);

  // Calculate trend
  const recentNdvi = ndviValues.slice(0, 3).reduce((a, b) => a + b, 0) / Math.max(1, ndviValues.slice(0, 3).length);
  const olderNdvi = ndviValues.slice(-3).reduce((a, b) => a + b, 0) / Math.max(1, ndviValues.slice(-3).length);
  const ndviTrend = ((recentNdvi - olderNdvi) / Math.max(0.001, olderNdvi)) * 100; // percentage change

  return {
    parkId,
    timestamp: now,
    areaHectares: round2(parkAreaHa),
    averageNdvi: round2(avgNdvi),
    annualCo2SequestrationTonnes: round2(annualCo2SequestrationTonnes),
    biodiversityCarbon: round2(speciesCarbon),
    totalCarbonValue: round2(annualCo2SequestrationTonnes + speciesCarbon),
    treeCanopyCoveragePercent: round2(treeCanopyCoverage),
    ndviTrendPercent: round2(ndviTrend),
    vegetationHealthStatus: getVegetationStatus(avgNdvi),
    dataPoints: {
      satelliteImages: satelliteData.length,
      biodiversityObservations: biodiversityData.length,
      uniqueSpeciesCount: uniqueSpecies,
    },
  };
}

function getVegetationStatus(ndvi) {
  if (ndvi < -0.1) return "DEGRADED";
  if (ndvi < 0.2) return "POOR";
  if (ndvi < 0.4) return "MODERATE";
  if (ndvi < 0.6) return "GOOD";
  return "EXCELLENT";
}

function round2(n) {
  return Number((n ?? 0).toFixed(2));
}

module.exports = {
  calculateParkCarbon,
};
