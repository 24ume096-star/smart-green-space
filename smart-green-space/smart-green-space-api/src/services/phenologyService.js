const { prisma } = require("../config/prisma");

/**
 * Detect seasonal phenology milestones (Budburst, Peak, Senescence) 
 * by analyzing historical NDVI trends for a park.
 */
async function analyzePhenologyForPark(parkId) {
  const history = await prisma.satelliteImage.findMany({
    where: { parkId, ndviMean: { not: null } },
    orderBy: { capturedAt: "asc" },
  });

  if (history.length < 5) return []; // Need at least 5 data points for meaningful trend

  const currentYear = new Date().getFullYear();
  const yearlyTrend = history.filter(h => h.capturedAt.getFullYear() === currentYear);
  
  if (yearlyTrend.length === 0) return [];

  const events = [];
  
  // 1. Peak Greenness Detection
  const maxNdvi = Math.max(...yearlyTrend.map(h => h.ndviMean));
  const peakImage = yearlyTrend.find(h => h.ndviMean === maxNdvi);
  
  if (peakImage) {
    events.push({
      parkId,
      eventName: "PEAK_GREENNESS",
      eventDate: peakImage.capturedAt,
      ndviValue: peakImage.ndviMean,
      metadata: { source: "TREND_ANALYSIS_V1" }
    });
  }

  // 2. Budburst (Initial growth spike)
  const budburst = yearlyTrend.find(h => h.ndviMean > 0.35); // Heuristic threshold
  if (budburst && budburst.id !== peakImage?.id) {
    events.push({
      parkId,
      eventName: "BUDBURST",
      eventDate: budburst.capturedAt,
      ndviValue: budburst.ndviMean,
    });
  }

  // 3. Senescence (Beginning of leaf-off)
  const afterPeak = yearlyTrend.filter(h => h.capturedAt > peakImage.capturedAt);
  const senescence = afterPeak.find(h => h.ndviMean < maxNdvi * 0.85);
  if (senescence) {
    events.push({
      parkId,
      eventName: "SENESCENCE",
      eventDate: senescence.capturedAt,
      ndviValue: senescence.ndviMean,
    });
  }

  // Persist unique events (primitive duplicate check by name+year)
  for (const event of events) {
    const exists = await prisma.phenologyEvent.findFirst({
      where: {
        parkId,
        eventName: event.eventName,
        eventDate: {
          gte: new Date(currentYear, 0, 1),
          lte: new Date(currentYear, 11, 31)
        }
      }
    });

    if (!exists) {
      await prisma.phenologyEvent.create({ data: event });
    }
  }

  return events;
}

module.exports = { analyzePhenologyForPark };
