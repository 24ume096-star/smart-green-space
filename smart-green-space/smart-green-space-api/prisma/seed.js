const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const city = await prisma.city.create({
    data: {
      name: "Bengaluru",
      state: "Karnataka",
      country: "India",
      lat: 12.9716,
      lng: 77.5946,
      timezone: "Asia/Kolkata",
      subscriptionPlan: "PRO",
      subscriptionStatus: "ACTIVE",
    },
  });

  const parks = await Promise.all([
    prisma.park.create({
      data: {
        cityId: city.id,
        name: "Cubbon Urban Park",
        area: 121.4,
        lat: 12.9763,
        lng: 77.5929,
        geoJsonBoundary: { type: "Polygon", coordinates: [] },
        establishedYear: 1870,
        type: "URBAN_PARK",
        isActive: true,
      },
    }),
    prisma.park.create({
      data: {
        cityId: city.id,
        name: "Lalbagh Botanical Garden",
        area: 97.2,
        lat: 12.9507,
        lng: 77.5848,
        geoJsonBoundary: { type: "Polygon", coordinates: [] },
        establishedYear: 1760,
        type: "GARDEN",
        isActive: true,
      },
    }),
    prisma.park.create({
      data: {
        cityId: city.id,
        name: "Yelahanka Wetland Reserve",
        area: 53.6,
        lat: 13.0991,
        lng: 77.5963,
        geoJsonBoundary: { type: "Polygon", coordinates: [] },
        establishedYear: 2008,
        type: "WETLAND",
        isActive: true,
      },
    }),
  ]);

  const zones = await Promise.all(
    parks.map((park, idx) =>
      prisma.irrigationZone.create({
        data: {
          parkId: park.id,
          name: `Main Zone ${idx + 1}`,
          zoneCode: `ZONE-${idx + 1}`,
          areaM2: 10000 + idx * 3000,
          isAutoMode: true,
          targetMoisture: 36 + idx,
          lat: park.lat,
          lng: park.lng,
          geoJsonBoundary: { type: "Polygon", coordinates: [] },
        },
      }),
    ),
  );

  const nodePayload = [];
  for (let i = 1; i <= 10; i += 1) {
    const parkIndex = (i - 1) % parks.length;
    const park = parks[parkIndex];
    const zone = zones[parkIndex];
    nodePayload.push({
      parkId: park.id,
      zoneId: zone.id,
      nodeCode: `NODE-${String(i).padStart(3, "0")}`,
      lat: park.lat + i * 0.0005,
      lng: park.lng + i * 0.0005,
      model: "SGS-EDGE-V2",
      firmwareVersion: "2.1.0",
      status: i % 4 === 0 ? "ALERT" : "ONLINE",
      lastPingAt: new Date(),
      batteryLevel: Math.max(20, 95 - i * 4),
      signalStrength: -55 - i,
      edgeAiEnabled: i % 2 === 0,
      installationDate: new Date("2025-01-15T00:00:00.000Z"),
    });
  }

  await prisma.sensorNode.createMany({
    data: nodePayload,
  });

  const nodes = await prisma.sensorNode.findMany({
    orderBy: { nodeCode: "asc" },
  });

  const readingPayload = [];
  const now = Date.now();
  nodes.forEach((node, nodeIndex) => {
    for (let step = 0; step < 6; step += 1) {
      const timestamp = new Date(now - step * 15 * 60 * 1000 - nodeIndex * 60 * 1000);
      const temperature = 26 + nodeIndex * 0.4 + step * 0.2;
      const humidity = 52 + (nodeIndex % 5) * 3 - step;
      const pm25 = 14 + nodeIndex + step;
      const anomaly = pm25 > 22;

      readingPayload.push({
        nodeId: node.id,
        timestamp,
        soilMoisture: 34 + (nodeIndex % 4) * 2 - step * 0.4,
        temperature,
        humidity,
        airQualityPM25: pm25,
        airQualityPM10: 24 + nodeIndex + step * 1.2,
        co2Level: 420 + nodeIndex * 12 + step * 3,
        lightIntensity: 600 + nodeIndex * 20 - step * 35,
        windSpeed: 2.1 + (nodeIndex % 3) * 0.5,
        isAnomaly: anomaly,
        anomalyScore: anomaly ? 0.78 : 0.21,
        anomalyType: anomaly ? "PM25_SPIKE" : null,
      });
    }
  });

  await prisma.sensorReading.createMany({
    data: readingPayload,
  });

  console.log("Seed completed:");
  console.log(`- City: ${city.name}`);
  console.log(`- Parks: ${parks.length}`);
  console.log(`- Sensor nodes: ${nodes.length}`);
  console.log(`- Sensor readings: ${readingPayload.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
