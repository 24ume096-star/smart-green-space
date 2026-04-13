const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const PARK_BASE_NDVI = {
  "delhi-lodhi-garden": 0.54,
  "delhi-nehru-park-delhi": 0.49,
  "delhi-sunder-nursery": 0.57,
  "delhi-deer-park-hauz-khas": 0.46,
  "delhi-millennium-park-delhi": 0.42,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

async function main() {
  const parks = await prisma.park.findMany({
    where: { cityId: "delhi-city", isActive: true },
    select: { id: true, name: true },
  });

  if (parks.length === 0) {
    console.log("No active Delhi parks found.");
    return;
  }

  const createdRows = [];
  const now = new Date();

  for (const park of parks) {
    const base = PARK_BASE_NDVI[park.id] ?? 0.45;

    for (let i = 0; i < 12; i += 1) {
      const capturedAt = new Date(now);
      capturedAt.setDate(capturedAt.getDate() - i * 7);

      const seasonal = Math.sin(i / 2.5) * 0.04;
      const trend = (12 - i) * 0.002;
      const noise = ((i % 3) - 1) * 0.005;
      const ndviMean = clamp(base + seasonal + trend + noise, -1, 1);
      const ndviMin = clamp(ndviMean - 0.12, -1, 1);
      const ndviMax = clamp(ndviMean + 0.11, -1, 1);

      const row = await prisma.satelliteImage.create({
        data: {
          parkId: park.id,
          capturedAt,
          source: i % 2 === 0 ? "SENTINEL2" : "LANDSAT",
          imageUrl: `https://example.com/satellite/${park.id}/${capturedAt.toISOString()}.tif`,
          ndviMapUrl: `https://example.com/ndvi/${park.id}/${capturedAt.toISOString()}.png`,
          thermalMapUrl: `https://example.com/thermal/${park.id}/${capturedAt.toISOString()}.png`,
          cloudCoverage: clamp(8 + i * 1.8, 0, 100),
          ndviMean,
          ndviMin,
          ndviMax,
          processedAt: new Date(),
        },
      });

      createdRows.push({ id: row.id, parkId: row.parkId, ndviMean: row.ndviMean });
    }
  }

  console.log(
    JSON.stringify(
      {
        parks: parks.length,
        rowsInserted: createdRows.length,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
