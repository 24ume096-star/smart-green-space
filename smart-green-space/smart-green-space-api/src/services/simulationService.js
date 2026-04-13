const { prisma } = require("../config/prisma");
const { simulationsQueue } = require("../config/queue");
const { redis } = require("../config/redis");
const { getIo } = require("../websocket/socketHandler");
const { logger } = require("../utils/logger");
const { bumpVersion, parkVersionKey, cityVersionKey } = require("../utils/cache");
const { calculateGshi } = require("./gshiService");

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function round2(n) {
  return Number((n ?? 0).toFixed(2));
}

async function runSimulationAsync({ parkId, runBy, scenario, parameters }) {
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

  const record = await prisma.digitalTwinSimulation.create({
    data: {
      parkId,
      runBy,
      scenario,
      parameters,
      status: "RUNNING",
    },
    select: { id: true, status: true },
  });

  await simulationsQueue.add(
    "run",
    { simulationId: record.id },
    { removeOnComplete: 200, attempts: 2 },
  );

  return { simulationId: record.id, status: record.status };
}

async function getSimulation(simulationId) {
  return prisma.digitalTwinSimulation.findUnique({
    where: { id: simulationId },
    include: {
      park: { select: { id: true, name: true, cityId: true } },
      runByUser: { select: { id: true, email: true, role: true } },
    },
  });
}

async function getParkSimulations(parkId) {
  return prisma.digitalTwinSimulation.findMany({
    where: { parkId },
    orderBy: { runAt: "desc" },
    take: 50,
  });
}

function getParkContextHeuristics(park) {
  // GeoJSON boundary rarely has elevation; use area + NDVI as proxies.
  const area = Number(park.area || 0); // hectares? (depends on seed) - still useful as relative scale
  return {
    sizeFactor: clamp(area / 50, 0.3, 2.0),
  };
}

async function computeScenarioResult({ sim, park }) {
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [latestSat, sensorAgg, currentGshi] = await Promise.all([
    prisma.satelliteImage.findFirst({
      where: { parkId: park.id },
      orderBy: { capturedAt: "desc" },
      select: { ndviMean: true, ndviZones: true, thermalMeanC: true, capturedAt: true },
    }),
    prisma.sensorReading.aggregate({
      where: { node: { parkId: park.id, isActive: true }, timestamp: { gte: last24h } },
      _avg: { temperature: true, soilMoisture: true },
    }),
    prisma.gshiScore.findFirst({ where: { parkId: park.id }, orderBy: { calculatedAt: "desc" } }),
  ]);

  const ndviMean = typeof latestSat?.ndviMean === "number" ? latestSat.ndviMean : 0.45;
  const zones = latestSat?.ndviZones || { healthy: 55, stressed: 30, bare: 15 };
  const avgTemp = sensorAgg._avg.temperature ?? 32;
  const avgMoisture = sensorAgg._avg.soilMoisture ?? 45;

  const ctx = getParkContextHeuristics(park);
  const p = sim.parameters || {};

  if (sim.scenario === "FLOOD") {
    const rain = Number(p.rainfallIntensityMmHr ?? 80);
    const saturation = clamp((avgMoisture - 40) / 60, 0, 1);
    const floodFactor = clamp((rain / 100) * (0.6 + 0.8 * saturation) * ctx.sizeFactor, 0, 2);
    const floodedAreaPct = round2(clamp(floodFactor * 18, 0, 90));
    const zonesAtRisk = Math.max(1, Math.round(floodedAreaPct / 8));
    const estimatedRecoveryDays = Math.round(clamp(2 + floodFactor * 10, 2, 30));

    return {
      floodedAreaPct,
      zonesAtRisk,
      estimatedRecoveryDays,
    };
  }

  if (sim.scenario === "HEAT_WAVE") {
    const tempInc = Number(p.temperatureIncreaseCelsius ?? 2.5);
    const vegCooling = clamp((ndviMean - 0.2) / 0.6, 0, 1); // 0..1
    const barePct = Number(zones?.bare ?? 15);
    const heatPocketMultiplier = 1 + clamp(barePct / 50, 0, 1); // 1..2
    const coolingEffect = round2(clamp(vegCooling * 0.55 * tempInc, 0, tempInc));
    const maxTempIncrease = round2(clamp(tempInc * heatPocketMultiplier - coolingEffect, 0, 15));
    const heatZones = Math.max(1, Math.round(2 + barePct / 10));

    return {
      maxTempIncrease,
      heatZones,
      coolingEffect: round2(coolingEffect),
      baselineAvgTempC: round2(Number(avgTemp) || 0),
    };
  }

  if (sim.scenario === "TREE_GROWTH") {
    const horizon = Number(p.timeHorizonYears ?? 5);
    const vegChangePct = Number(p.vegetationChangePct ?? 0);
    const baseCoverage = clamp(((ndviMean + 1) / 2) * 100, 0, 100);
    const growthRatePctPerYear = clamp(3.5 + (ndviMean - 0.4) * 6, 1, 8);
    
    const projections = [];
    for (let yr = 1; yr <= Math.max(horizon, 10); yr++) {
      const projected = round2(clamp(baseCoverage + growthRatePctPerYear * yr + vegChangePct, 0, 100));
      const vegetationDelta = (projected - baseCoverage) / 100;
      const predictedGshi = round2(clamp((currentGshi?.overallScore ?? 60) + vegetationDelta * 18, 0, 100));
      
      projections.push({
        year: yr,
        coverage: projected,
        gshi: predictedGshi,
        lowerBound: round2(clamp(predictedGshi - (yr * 0.8), 0, 100)),
        upperBound: round2(clamp(predictedGshi + (yr * 0.4), 0, 100))
      });
    }

    const { gshi: gshiInHorizon, coverage: projectedCoverage } = projections[Math.min(horizon, projections.length) - 1];
    const carbonSequestration = round2((projectedCoverage / 100) * ctx.sizeFactor * horizon * 12.5);

    return {
      projectedCoverage,
      carbonSequestration,
      gshiInHorizon,
      projections,
      uncertaintyBands: true
    };
  }

  // DROUGHT
  const horizonYears = Number(p.timeHorizonYears ?? 0);
  const evap = clamp((avgTemp - 28) / 15, 0, 1);
  const initialMoisture = Number(avgMoisture) || 45;
  const depletionPerDay = 2.2 + evap * 3.5;
  const stressThreshold = 30;
  const daysToStress = Math.round(clamp((initialMoisture - stressThreshold) / depletionPerDay, 1, 60));
  const criticalZones = Math.max(1, Math.round((Number(zones?.stressed ?? 30) + Number(zones?.bare ?? 15)) / 12));
  const waterNeedLiters = Math.round(clamp(ctx.sizeFactor * criticalZones * 800 * (1 + horizonYears * 0.05), 500, 200_000));

  return {
    daysToStress,
    criticalZones,
    waterNeedLiters,
  };
}

function buildInterventions(scenario, result) {
  if (scenario === "FLOOD") {
    return [
      { type: "DRAINAGE", label: "Clear drains and improve runoff paths", impact: "Reduce floodedAreaPct" },
      { type: "SENSOR_DEPLOY", label: "Deploy temporary water level sensors", impact: "Increase monitoring" },
    ];
  }
  if (scenario === "HEAT_WAVE") {
    return [
      { type: "IRRIGATION", label: "Increase irrigation in bare/stressed zones", impact: "Lower heat pockets" },
      { type: "SHADE", label: "Add shade nets for critical areas", impact: "Reduce maxTempIncrease" },
    ];
  }
  if (scenario === "TREE_GROWTH") {
    return [
      { type: "PLANTING", label: "Plant native fast-growing canopy species", impact: "Increase projectedCoverage" },
      { type: "MAINTENANCE", label: "Optimize pruning + soil nutrients", impact: "Increase growth rate" },
    ];
  }
  return [
    { type: "IRRIGATION", label: "Prioritize irrigation for critical zones", impact: "Delay daysToStress" },
    { type: "MULCHING", label: "Mulch to reduce evapotranspiration", impact: "Reduce waterNeedLiters" },
  ];
}

async function finalizeSimulation(simulationId) {
  const sim = await prisma.digitalTwinSimulation.findUnique({ where: { id: simulationId } });
  if (!sim) return null;
  if (sim.status !== "RUNNING") return sim;

  const park = await prisma.park.findUnique({
    where: { id: sim.parkId },
    select: { id: true, cityId: true, name: true, area: true, geoJsonBoundary: true },
  });
  if (!park) {
    return prisma.digitalTwinSimulation.update({
      where: { id: simulationId },
      data: { status: "FAILED", result: { error: "Park not found" } },
    });
  }

  const result = await computeScenarioResult({ sim, park });

  // predicted GSHI heuristic: adjust current score based on scenario output
  const current = await prisma.gshiScore.findFirst({
    where: { parkId: park.id },
    orderBy: { calculatedAt: "desc" },
    select: { overallScore: true },
  });
  const baseGshi = current?.overallScore ?? 60;

  let predictedGshi = baseGshi;
  if (sim.scenario === "FLOOD") predictedGshi -= (result.floodedAreaPct / 100) * 18;
  if (sim.scenario === "HEAT_WAVE") predictedGshi -= (result.maxTempIncrease / 10) * 12;
  if (sim.scenario === "TREE_GROWTH") predictedGshi = result.gshiInHorizon;
  if (sim.scenario === "DROUGHT") predictedGshi -= (1 - clamp(result.daysToStress / 30, 0, 1)) * 14;

  predictedGshi = round2(clamp(predictedGshi, 0, 100));
  const confidenceScore = round2(clamp(0.55 + Math.random() * 0.35, 0, 1));

  const interventions = buildInterventions(sim.scenario, result);

  const saved = await prisma.digitalTwinSimulation.update({
    where: { id: simulationId },
    data: {
      status: "COMPLETE",
      result: { ...result, interventions },
      predictedGshi,
      confidenceScore,
    },
  });

  const payload = {
    simulationId,
    parkId: park.id,
    cityId: park.cityId,
    scenario: sim.scenario,
    status: saved.status,
    predictedGshi,
    confidenceScore,
    result: saved.result,
    completedAt: new Date().toISOString(),
  };

  try {
    await redis.publish(`simulation:${park.id}`, JSON.stringify(payload));
  } catch (_) {
    // non-fatal
  }

  const io = getIo();
  if (io) {
    io.to(`park:${park.id}`).emit("simulation:complete", payload);
    io.to(`city:${park.cityId}`).emit("simulation:complete", payload);
  }

  await bumpVersion(parkVersionKey(park.id));
  await bumpVersion(cityVersionKey(park.cityId));

  logger.info("simulation_complete", { simulationId, parkId: park.id, scenario: sim.scenario });
  return saved;
}

module.exports = {
  runSimulationAsync,
  getSimulation,
  getParkSimulations,
  finalizeSimulation,
};

