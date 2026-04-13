const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

function toNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeNdvi(raw) {
  if (raw == null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  // AppEEARS MOD13Q1 NDVI often comes scaled by 10000
  if (Math.abs(n) > 1.2) return n / 10000;
  return n;
}

function dateFromAppeears(value) {
  // Supports YYYY-MM-DD and YYYYDDD formats.
  if (!value) return new Date();
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return new Date(value);
  if (/^\d{7}$/.test(value)) {
    const year = Number(value.slice(0, 4));
    const dayOfYear = Number(value.slice(4));
    const dt = new Date(Date.UTC(year, 0, 1));
    dt.setUTCDate(dt.getUTCDate() + dayOfYear - 1);
    return dt;
  }
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? new Date() : dt;
}

async function main() {
  const csvArg = process.argv[2];
  const mapArg = process.argv[3] || "scripts/delhi-park-map.json";
  if (!csvArg) {
    throw new Error(
      "Usage: node scripts/ingest-appeears-csv.js <csv-file> [park-map-json]",
    );
  }

  const csvPath = path.resolve(process.cwd(), csvArg);
  const mapPath = path.resolve(process.cwd(), mapArg);
  const csv = fs.readFileSync(csvPath, "utf8");
  const parkMap = JSON.parse(fs.readFileSync(mapPath, "utf8"));

  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) throw new Error("CSV appears empty");

  const headers = parseCsvLine(lines[0]);
  const idx = Object.fromEntries(headers.map((h, i) => [h, i]));

  const required = ["park_key", "date", "ndvi_mean"];
  for (const key of required) {
    if (idx[key] == null) {
      throw new Error(`Missing required column '${key}'. Expected: ${required.join(", ")}`);
    }
  }

  let inserted = 0;
  let skipped = 0;
  for (let i = 1; i < lines.length; i += 1) {
    const row = parseCsvLine(lines[i]);
    const parkKey = row[idx.park_key];
    const parkId = parkMap[parkKey];
    if (!parkId) {
      skipped += 1;
      continue;
    }

    const ndviMean = normalizeNdvi(row[idx.ndvi_mean]);
    const ndviMin = normalizeNdvi(row[idx.ndvi_min]);
    const ndviMax = normalizeNdvi(row[idx.ndvi_max]);
    const capturedAt = dateFromAppeears(row[idx.date]);

    await prisma.satelliteImage.create({
      data: {
        parkId,
        capturedAt,
        source: "LANDSAT",
        imageUrl: row[idx.image_url] || `https://appeears.earthdatacloud.nasa.gov/`,
        ndviMapUrl: row[idx.ndvi_map_url] || null,
        thermalMapUrl: row[idx.thermal_map_url] || null,
        cloudCoverage: toNum(row[idx.cloud_coverage]),
        ndviMean,
        ndviMin,
        ndviMax,
        processedAt: new Date(),
      },
    });
    inserted += 1;
  }

  console.log(JSON.stringify({ rows: lines.length - 1, inserted, skipped }, null, 2));
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
