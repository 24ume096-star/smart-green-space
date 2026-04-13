const { prisma } = require("../config/prisma");
const { logger } = require("../utils/logger");
const { getIo } = require("../websocket");
const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);
const fs = require("fs");
const path = require("path");

/**
 * calculateFloodRisk(parkId)
 * Returns { riskScore, riskLevel, timeToOverflowMin, affectedZones, recommendedActions }
 */
async function calculateFloodRisk(parkId) {
  logger.info("calculateFloodRisk_started", { parkId });
  
  // Real EarthData ML Pipeline Execution
  let mlMaxRiskScore = 0;
  try {
     const { getProductionModelPath } = require("./modelRegistryService");
     let scriptPath = await getProductionModelPath("earthdata_flood_pipeline");
     
     if (!scriptPath) {
       logger.warn("Model registry: 'earthdata_flood_pipeline' not found. Falling back to default.");
       scriptPath = path.join(__dirname, "..", "ml", "pipeline.py");
     } else {
       logger.info(`Using production version from registry: ${scriptPath}`);
     }

     logger.info("Spawning Python EarthData pipeline...");
     // Using the natively installed globally available python running the EarthData process natively!
     await execPromise(`python "${scriptPath}" "${parkId}"`);
     
     const geojsonPath = path.join(__dirname, "..", "..", "public", "heatmaps", `${parkId}_heatmap.geojson`);
     if (fs.existsSync(geojsonPath)) {
         const rawData = fs.readFileSync(geojsonPath, 'utf8');
         const featureCollection = JSON.parse(rawData);
         
         let maxFloatScore = 0;
         if (featureCollection.features) {
             for(let feature of featureCollection.features) {
                 const rs = feature.properties.riskScore || 0;
                 if (rs > maxFloatScore) maxFloatScore = rs;
             }
         }
         mlMaxRiskScore = Math.min(100, Math.round(maxFloatScore * 100));
         logger.info(`Earthdata ML completed correctly with dynamic max risk score: ${mlMaxRiskScore}`);
     }
  } catch(e) {
     logger.error("Failed executing python ML script or parsing geojson:", e);
  }
  
  const drains = await prisma.drainNode.findMany({
    where: { parkId },
    include: {
      readings: { orderBy: { timestamp: 'desc' }, take: 1 }
    }
  });

  // Mock fetching latest soil moisture
  const moistureReadings = await prisma.sensorReading.findMany({
    where: { node: { parkId }, soilMoisture: { not: null } },
    orderBy: { timestamp: 'desc' },
    take: 10
  });

  let maxRiskScore = mlMaxRiskScore;
  let overallRiskLevel = 'LOW';

  if (maxRiskScore >= 65) overallRiskLevel = 'EMERGENCY';
  else if (maxRiskScore >= 40) overallRiskLevel = 'WARNING';
  else if (maxRiskScore > 15) overallRiskLevel = 'WATCH';

  let minTimeToOverflow = Infinity;
  let affectedZones = [];

  for (const drain of drains) {
    const currentLevel = drain.readings[0]?.waterLevelCm || 0;
    const maxCapacity = drain.maxCapacityCm;
    
    // Mock algorithm steps
    const currentMoisture = moistureReadings[0]?.soilMoisture || 50;
    const fieldCapacity = 100;
    const soilSaturationRatio = currentMoisture / fieldCapacity;
    
    const runoffCoefficient = 0.6; // Mock derived from NDVI/imperviousPct
    const rainfallIntensity = 25; // mm/hr (Mock value from OpenWeatherMap)
    
    const rainfallExcess = rainfallIntensity * runoffCoefficient;
    const drainCapacityRemaining = maxCapacity - currentLevel;
    
    const infiltrationRate = 5; // mm/hr
    const netFillRate = (rainfallExcess - infiltrationRate);
    
    let timeToOverflowMin = Infinity;
    if (netFillRate > 0) {
       timeToOverflowMin = (drainCapacityRemaining / netFillRate) * 60;
    }

    let score = 0;
    let level = 'LOW';

    if (timeToOverflowMin < 30) {
      score = 95; level = 'EMERGENCY';
    } else if (timeToOverflowMin <= 60) {
      score = 75; level = 'WARNING';
    } else if (timeToOverflowMin <= 180) {
      score = 45; level = 'WATCH';
    } else {
      score = 15;
    }

    if (score > maxRiskScore) {
      maxRiskScore = score;
      overallRiskLevel = level;
      minTimeToOverflow = timeToOverflowMin;
    }
    
    if (level !== 'LOW' && drain.zoneId && !affectedZones.includes(drain.zoneId)) {
      affectedZones.push(drain.zoneId);
    }
  }

  let recommendedActions = [];
  if (overallRiskLevel === 'EMERGENCY') recommendedActions = ["Evacuate park", "Open all valves", "Notify Emergency Services"];
  else if (overallRiskLevel === 'WARNING') recommendedActions = ["Open auto drainage valves", "Clear partial blockages", "Alert citizens"];
  else if (overallRiskLevel === 'WATCH') recommendedActions = ["Monitor water levels", "Log watch event"];

  return {
    riskScore: maxRiskScore,
    riskLevel: overallRiskLevel,
    timeToOverflowMin: minTimeToOverflow,
    affectedZones,
    recommendedActions
  };
}

/**
 * triggerDrainageResponse(parkId, riskLevel)
 */
async function triggerDrainageResponse(parkId, riskLevel) {
  logger.info("triggerDrainageResponse_invoked", { parkId, riskLevel });

  if (riskLevel === 'WATCH') {
    await prisma.actionLog.create({
      data: {
        parkId,
        actionType: "ALERT_ESCALATED",
        description: "Flood WATCH initiated",
        isAutomated: true
      }
    });

  } else if (riskLevel === 'WARNING') {
    await prisma.drainageValve.updateMany({
      where: { parkId, isAutoMode: true },
      data: { isOpen: true, lastActuatedAt: new Date() }
    });
    logger.info("push_notifications_dispatched", { parkId, message: "Flood WARNING in park zones." });

  } else if (riskLevel === 'EMERGENCY') {
    await prisma.drainageValve.updateMany({
      where: { parkId },
      data: { isOpen: true, lastActuatedAt: new Date() }
    });

    await prisma.floodEvent.create({
        data: {
            parkId,
            severity: 'EMERGENCY',
            responseActions: ["Opened all valves", "Notified emergency services"]
        }
    });
    
    // Real-time updates over Socket.io
    const io = getIo();
    if (io) {
        if(!global.emergencyIntervals) global.emergencyIntervals = {};
        if(!global.emergencyIntervals[parkId]) {
            global.emergencyIntervals[parkId] = setInterval(() => {
                io.emit("flood_emergency_update", { parkId, timestamp: new Date(), message: "Continuous flood emergency broadcast..." });
            }, 30000);
        }
    }
  }
}

/**
 * monitorBlockages()
 * Cron: every 2 minutes
 */
async function monitorBlockages() {
  logger.info("monitorBlockages_started");
  const drains = await prisma.drainNode.findMany({
    include: {
        readings: { orderBy: { timestamp: 'desc' }, take: 2 }
    }
  });

  for (const drain of drains) {
    if (drain.readings.length >= 2) {
        const latest = drain.readings[0];
        const previous = drain.readings[1];

        const risingLevel = latest.waterLevelCm > previous.waterLevelCm;
        const lowFlow = latest.flowRateLPerMin < 5;

        // Blockage detected
        if (risingLevel && lowFlow && !drain.isBlocked) {
            logger.warn(`Drain blockage detected at node: ${drain.nodeCode}`);
            
            await prisma.drainNode.update({
                where: { id: drain.id },
                data: { isBlocked: true }
            });

            const alert = await prisma.alert.create({
                data: {
                    parkId: drain.parkId,
                    severity: "CRITICAL",
                    type: "FLOOD_RISK",
                    title: `Blockage Detected at ${drain.nodeCode}`,
                    description: `Water levels are rising but flow rate is extremely low (${latest.flowRateLPerMin} L/min). Dispatching maintenance.`,
                    status: "OPEN"
                }
            });

            await prisma.actionLog.create({
                data: {
                    parkId: drain.parkId,
                    alertId: alert.id,
                    actionType: "MAINTENANCE_ASSIGNED",
                    description: `Maintenance team dispatched for blocked drain ${drain.nodeCode}`,
                    isAutomated: true
                }
            });
        }
    }
  }
  logger.info("monitorBlockages_completed");
}

module.exports = {
  calculateFloodRisk,
  triggerDrainageResponse,
  monitorBlockages
};
