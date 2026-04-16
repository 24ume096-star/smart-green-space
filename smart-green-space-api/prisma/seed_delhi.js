const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Delhi data...");

  // 1. Create Delhi City
  const city = await prisma.city.upsert({
    where: { id: "delhi-city" },
    update: {},
    create: {
      id: "delhi-city",
      name: "Delhi",
      state: "Delhi NCR",
      country: "India",
      lat: 28.6139,
      lng: 77.2090,
      timezone: "Asia/Kolkata",
      subscriptionPlan: "ENTERPRISE",
      subscriptionStatus: "ACTIVE",
    },
  });

  // 2. Delhi Parks
  const delhiParks = [
    { id: "deer", name: "Deer Park Hauz Khas", lat: 28.5494, lng: 77.2001, area: 72 },
    { id: "lodhi", name: "Lodhi Garden", lat: 28.5920, lng: 77.2197, area: 90 },
    { id: "nehru", name: "Nehru Park Delhi", lat: 28.5979, lng: 77.1836, area: 80 },
    { id: "sunder", name: "Sunder Nursery", lat: 28.5934, lng: 77.2437, area: 90 },
    { id: "garden", name: "Garden of Five Senses", lat: 28.5104, lng: 77.1869, area: 20 },
    { id: "millennium", name: "Millennium Park Delhi", lat: 28.6418, lng: 77.2466, area: 55 },
  ];

  for (const p of delhiParks) {
    const park = await prisma.park.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        cityId: city.id,
        name: p.name,
        area: p.area,
        lat: p.lat,
        lng: p.lng,
        type: "URBAN_PARK",
        isActive: true,
      },
    });

    // 3. Create a default Irrigation Zone (Required for SensorNode)
    const zone = await prisma.irrigationZone.upsert({
      where: { parkId_zoneCode: { parkId: p.id, zoneCode: "MAIN" } },
      update: {},
      create: {
        parkId: p.id,
        name: "Main Irrigation Zone",
        zoneCode: "MAIN",
        areaM2: p.area * 1000,
        lat: p.lat,
        lng: p.lng,
      },
    });

    // 4. Create a Sensor Node
    const node = await prisma.sensorNode.upsert({
      where: { nodeCode: `NODE-${p.id.toUpperCase()}` },
      update: {},
      create: {
        parkId: p.id,
        zoneId: zone.id,
        nodeCode: `NODE-${p.id.toUpperCase()}`,
        lat: p.lat,
        lng: p.lng,
        status: "ONLINE",
        batteryLevel: 98,
        isActive: true,
      },
    });

    // 5. Insert 24 hours of sensor data
    const readings = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
        const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
        readings.push({
            nodeId: node.id,
            timestamp,
            temperature: 32 + Math.random() * 5,
            humidity: 25 + Math.random() * 10,
            soilMoisture: 35 + Math.random() * 15,
            airQualityPM25: 45 + Math.random() * 20,
            airQualityPM10: 80 + Math.random() * 30,
            co2Level: 420 + Math.random() * 50,
        });
    }
    await prisma.sensorReading.createMany({ data: readings });

    // 6. Seed Satellite Data (NDVI)
    await prisma.satelliteImage.create({
      data: {
        parkId: park.id,
        source: "SENTINEL2",
        capturedAt: new Date(),
        imageUrl: "https://example.com/ndvi.png",
        ndviMean: 0.55 + Math.random() * 0.15,
      }
    });

    // 7. Seed Biodiversity Log
    await prisma.biodiversityLog.create({
        data: {
            parkId: park.id,
            detectedAt: new Date(),
            speciesName: "Indian Peafowl",
            speciesType: "BIRD",
            detectionMethod: "CAMERA_TRAP",
            confidence: 0.95,
            count: 2
        }
    });

    // 8. Trigger Initial GSHI Calculation
    // We can't import the service easily here, so we will manually create a record
    // that the dashboard can read immediately.
    const vegFactor = 0.55 + Math.random() * 0.2;
    await prisma.gshiScore.create({
        data: {
            parkId: p.id,
            calculatedAt: new Date(),
            overallScore: 82 + Math.random() * 10,
            vegetationScore: vegFactor * 100,
            thermalScore: 75 + Math.random() * 15,
            waterScore: 80 + Math.random() * 10,
            biodiversityScore: 85 + Math.random() * 5,
            airQualityScore: 70 + Math.random() * 20,
            infrastructureScore: 75,
            treeHealthScore: 88,
            ndviValue: vegFactor
        }
    });
  }

  console.log("Delhi Data Seeding & GSHI Populated.");
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
