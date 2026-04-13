const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

/**
 * Usage:
 * node scripts/ingest-ndvi-from-json.js data/ndvi-delhi.json
 *
 * Expected JSON format:
 * [
 *   {
 *     "parkId": "delhi-lodhi-garden",
 *     "capturedAt": "2026-04-01T00:00:00.000Z",
 *     "source": "SENTINEL2",
 *     "ndviMean": 0.55,
 *     "ndviMin": 0.31,
 *     "ndviMax": 0.72,
 *     "imageUrl": "https://...",
 *     "ndviMapUrl": "https://...",
 *     "thermalMapUrl": "https://..."
 *   }
 * ]
 */

function mustNumber(value, key) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid numeric value for ${key}`);
  }
  return n;
}

async function main() {
  const fileArg = process.argv[2];
  if (!fileArg) {
    throw new Error("Provide input JSON path. Example: node scripts/ingest-ndvi-from-json.js data/ndvi.json");
  }

  const filePath = path.resolve(process.cwd(), fileArg);
  const raw = fs.readFileSync(filePath, "utf8");
  const records = JSON.parse(raw);

  if (!Array.isArray(records)) {
    throw new Error("Input JSON must be an array");
  }

  let inserted = 0;
  for (const rec of records) {
    if (!rec.parkId || !rec.capturedAt || !rec.source) {
      throw new Error("Each row must include parkId, capturedAt, source");
    }

    await prisma.satelliteImage.create({
      data: {
        parkId: rec.parkId,
        capturedAt: new Date(rec.capturedAt),
        source: rec.source,
        imageUrl: rec.imageUrl || "https://example.com/satellite/unknown.tif",
        ndviMapUrl: rec.ndviMapUrl || null,
        thermalMapUrl: rec.thermalMapUrl || null,
        cloudCoverage: rec.cloudCoverage != null ? mustNumber(rec.cloudCoverage, "cloudCoverage") : null,
        ndviMean: rec.ndviMean != null ? mustNumber(rec.ndviMean, "ndviMean") : null,
        ndviMin: rec.ndviMin != null ? mustNumber(rec.ndviMin, "ndviMin") : null,
        ndviMax: rec.ndviMax != null ? mustNumber(rec.ndviMax, "ndviMax") : null,
        processedAt: new Date(),
      },
    });
    inserted += 1;
  }

  console.log(JSON.stringify({ inputRows: records.length, inserted }, null, 2));
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
