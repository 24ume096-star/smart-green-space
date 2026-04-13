const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// Delhi micro-climate profiles — based on real park characteristics
// Cooler: water-body parks, dense canopy. Hotter: open/urban areas.
const PARK_PROFILES = {
  "delhi-lodhi-garden": {
    // Dense tree canopy, historical garden — relatively cool
    tempBase: 27.2, tempVar: 1.5,
    moistBase: 48, moistVar: 8,
    treeHealthBase: 88, treeHealthVar: 5, // Well-maintained heritage trees
  },
  "delhi-nehru-park-delhi": {
    // Open grassy park, partial shade — moderate temp
    tempBase: 29.8, tempVar: 2.0,
    moistBase: 38, moistVar: 7,
    treeHealthBase: 75, treeHealthVar: 8,
  },
  "delhi-sunder-nursery": {
    // Dense horticultural garden, good canopy
    tempBase: 27.8, tempVar: 1.5,
    moistBase: 52, moistVar: 6,
    treeHealthBase: 91, treeHealthVar: 4,
  },
  "delhi-deer-park-hauz-khas": {
    // Near lake, forested — coolest park
    tempBase: 26.5, tempVar: 1.2,
    moistBase: 56, moistVar: 5,
    treeHealthBase: 83, treeHealthVar: 6,
  },
  "delhi-garden-of-five-senses": {
    // Hilly, open terraced garden — hotter
    tempBase: 31.5, tempVar: 2.2,
    moistBase: 35, moistVar: 8,
    treeHealthBase: 72, treeHealthVar: 9,
  },
  "delhi-millennium-park-delhi": {
    // Urban east Delhi, open riverside — hottest
    tempBase: 32.5, tempVar: 2.5,
    moistBase: 32, moistVar: 9,
    treeHealthBase: 65, treeHealthVar: 10,
  },
};

function rand(base, variance) {
  return base + (Math.random() - 0.5) * variance * 2;
}

async function deleteExistingTelemetry(parkId, nodeCode) {
  // delete existing sensor readings and tree scans for idempotency
  const node = await prisma.sensorNode.findUnique({ where: { nodeCode } });
  if (node) {
    await prisma.sensorReading.deleteMany({ where: { nodeId: node.id } });
  }
  await prisma.biodiversityLog.deleteMany({ where: { parkId } });
  await prisma.treeScan.deleteMany({ where: { parkId } });
}

async function main() {
  const parks = await prisma.park.findMany({
    where: { cityId: "delhi-city", isActive: true },
    select: { id: true, name: true, lat: true, lng: true },
  });

  if (parks.length === 0) {
    console.log("No active Delhi parks found. Run add-delhi-parks.js first.");
    return;
  }

  const now = new Date();
  console.log(`Seeding realistic telemetry for ${parks.length} parks...`);

  for (const park of parks) {
    const profile = PARK_PROFILES[park.id] ?? {
      tempBase: 30, tempVar: 2, moistBase: 40, moistVar: 8,
      treeHealthBase: 75, treeHealthVar: 8,
    };
    const nodeCode = `NODE-${park.id}`;

    console.log(`\n- ${park.name} (temp: ~${profile.tempBase}°C)`);

    await deleteExistingTelemetry(park.id, nodeCode);

    // 1. Ensure Zone
    const zone = await prisma.irrigationZone.upsert({
      where: { parkId_zoneCode: { parkId: park.id, zoneCode: `ZONE-${park.id}` } },
      update: {},
      create: {
        parkId: park.id, name: "Main Sector", zoneCode: `ZONE-${park.id}`,
        areaM2: 5000, isAutoMode: true, targetMoisture: 45,
        lat: park.lat, lng: park.lng,
        geoJsonBoundary: { type: "Polygon", coordinates: [] },
      },
    });

    // 2. Ensure Node
    const node = await prisma.sensorNode.upsert({
      where: { nodeCode },
      update: { lastPingAt: now, status: "ONLINE" },
      create: {
        parkId: park.id, zoneId: zone.id, nodeCode,
        lat: park.lat + 0.0001, lng: park.lng + 0.0001,
        model: "SGS-PRO-V1", firmwareVersion: "1.2.0",
        status: "ONLINE", lastPingAt: now, batteryLevel: 88,
        signalStrength: -62, edgeAiEnabled: true,
        installationDate: new Date("2026-01-01"),
      },
    });

    // 3. Sensor Readings — 24 readings (hourly), realistic micro-climate
    const readings = [];
    for (let i = 0; i < 24; i++) {
      const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
      // Diurnal variation: cooler at night, peak heat at 2pm
      const hourOfDay = (24 - i) % 24;
      const diurnal = Math.sin((hourOfDay - 6) * Math.PI / 12) * 2.5; // ±2.5°C swing
      const temp = rand(profile.tempBase + diurnal, profile.tempVar / 2);
      const moisture = rand(profile.moistBase, profile.moistVar);

      readings.push({
        nodeId: node.id, timestamp,
        temperature: Math.max(20, Math.min(45, temp)),
        humidity: 40 + Math.random() * 25,
        soilMoisture: Math.max(10, Math.min(90, moisture)),
        airQualityPM25: 10 + Math.random() * 15,
        airQualityPM10: 18 + Math.random() * 20,
        co2Level: 405 + Math.random() * 45,
        lightIntensity: hourOfDay > 6 && hourOfDay < 19 ? 300 + Math.random() * 600 : 0,
        isAnomaly: false,
      });
    }
    await prisma.sensorReading.createMany({ data: readings });

    // 4. Biodiversity Logs — park-specific species
    const speciesByType = [
      { name: "Common Myna", type: "BIRD" },
      { name: "Indian Peafowl", type: "BIRD" },
      { name: "Rose-ringed Parakeet", type: "BIRD" },
      { name: "Oriental Magpie-Robin", type: "BIRD" },
      { name: "Large Blue Butterfly", type: "INSECT" },
      { name: "Honey Bee", type: "INSECT" },
      { name: "Garden Lizard", type: "REPTILE" },
      { name: "Common Gecko", type: "REPTILE" },
      { name: "Indian Bullfrog", type: "AMPHIBIAN" },
    ];
    const bioLogs = [];
    // Forested parks get more species
    const numLogs = park.id.includes("lodhi") || park.id.includes("sunder") || park.id.includes("deer") ? 22 : 14;
    for (let i = 0; i < numLogs; i++) {
      const spec = speciesByType[Math.floor(Math.random() * speciesByType.length)];
      bioLogs.push({
        parkId: park.id,
        detectedAt: new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        speciesName: spec.name, speciesType: spec.type,
        detectionMethod: i % 3 === 0 ? "CITIZEN" : "CAMERA_TRAP",
        count: Math.floor(Math.random() * 5) + 1,
        confidence: 0.78 + Math.random() * 0.18,
        imageUrl: `https://example.com/bio/${park.id}/detection-${i}.jpg`,
      });
    }
    await prisma.biodiversityLog.createMany({ data: bioLogs });

    // 5. Tree Scans — park-specific health scores (KEY FIX: feeds treeHealthScore)
    const treeScanData = [];
    const numScans = 5;
    for (let i = 0; i < numScans; i++) {
      treeScanData.push({
        parkId: park.id,
        scanType: i % 2 === 0 ? "DRONE" : "CAMERA_TRAP",
        imageUrl: `https://example.com/tree/${park.id}/scan-${i}.jpg`,
        scannedAt: new Date(now.getTime() - i * 3 * 24 * 60 * 60 * 1000),
        aiHealthScore: Math.max(0, Math.min(100, rand(profile.treeHealthBase, profile.treeHealthVar))),
        diseasesDetected: [],
        confidence: 0.85 + Math.random() * 0.1,
        modelVersion: "tree-health-v2.1",
      });
    }
    await prisma.treeScan.createMany({ data: treeScanData });

    const avgTreeHealth = treeScanData.reduce((s, t) => s + t.aiHealthScore, 0) / treeScanData.length;
    console.log(`  ✓ Readings: 24 | BioLogs: ${numLogs} | TreeScans: ${numScans} (avg health: ${avgTreeHealth.toFixed(1)}%)`);
  }

  console.log("\n✅ Telemetry seeded successfully.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
