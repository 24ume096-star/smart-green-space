const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { calculateGshi } = require("../src/services/gshiService");

const prisma = new PrismaClient();

function textBetween(input, startTag, endTag) {
  const start = input.indexOf(startTag);
  if (start === -1) return null;
  const from = start + startTag.length;
  const end = input.indexOf(endTag, from);
  if (end === -1) return null;
  return input.slice(from, end).trim();
}

function normalizeWhitespace(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function toKey(name) {
  return normalizeWhitespace(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function csvEscape(value) {
  const v = value == null ? "" : String(value);
  if (/[",\n]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function parseMetadataXml(xml) {
  const productMatch = xml.match(
    /<gmd:title>\s*<gco:CharacterString>([^<]*MOD[0-9A-Z]+\.[0-9]+[^<]*)<\/gco:CharacterString>\s*<\/gmd:title>/,
  );
  const product = normalizeWhitespace(productMatch?.[1] || "MOD13Q1.061");

  const startDate =
    textBetween(xml, '<gml:TimeInstant gml:id="StartDate">', "</gml:TimeInstant>")
      ?.match(/<gml:timePosition>([^<]+)<\/gml:timePosition>/)?.[1] || "";
  const endDate =
    textBetween(xml, '<gml:TimeInstant gml:id="EndDate">', "</gml:TimeInstant>")
      ?.match(/<gml:timePosition>([^<]+)<\/gml:timePosition>/)?.[1] || "";

  const points = [];
  const pointRegex = /<gml:Point[\s\S]*?<gml:name>([\s\S]*?)<\/gml:name>[\s\S]*?<gml:pos>([\s\S]*?)<\/gml:pos>[\s\S]*?<\/gml:Point>/g;
  let m;
  while ((m = pointRegex.exec(xml)) !== null) {
    const parkName = normalizeWhitespace(m[1]);
    const pos = normalizeWhitespace(m[2]).split(/\s+/);
    const lat = Number(pos[0]);
    const lng = Number(pos[1]);
    points.push({
      park_key: toKey(parkName),
      park_name: parkName,
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      start_date: startDate,
      end_date: endDate,
      product,
    });
  }

  return points;
}

function toCsv(rows, columns) {
  const header = columns.join(",");
  const lines = rows.map((row) => columns.map((c) => csvEscape(row[c])).join(","));
  return [header, ...lines].join("\n");
}

async function calculateForRows(rows) {
  let dbAvailable = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (_) {
    dbAvailable = false;
  }

  const results = [];
  for (const row of rows) {
    if (!dbAvailable) {
      results.push({
        park_name: row.park_name,
        park_id: "",
        matched: "NO",
        overallScore: "",
        vegetationScore: "",
        thermalScore: "",
        waterScore: "",
        biodiversityScore: "",
        infrastructureScore: "",
        treeHealthScore: "",
        ndviValue: "",
        note: "Database unavailable; start Postgres then rerun script",
      });
      continue;
    }

    const park = await prisma.park.findFirst({
      where: { name: { equals: row.park_name, mode: "insensitive" } },
      select: { id: true, name: true },
    });

    if (!park) {
      results.push({
        park_name: row.park_name,
        park_id: "",
        matched: "NO",
        overallScore: "",
        vegetationScore: "",
        thermalScore: "",
        waterScore: "",
        biodiversityScore: "",
        infrastructureScore: "",
        treeHealthScore: "",
        ndviValue: "",
        note: "No exact park name match in DB",
      });
      continue;
    }

    const score = await calculateGshi(park.id, {
      infrastructureScore: 70,
      prismaClient: prisma,
    });

    results.push({
      park_name: park.name,
      park_id: park.id,
      matched: "YES",
      overallScore: score.overallScore,
      vegetationScore: score.vegetationScore,
      thermalScore: score.thermalScore,
      waterScore: score.waterScore,
      biodiversityScore: score.biodiversityScore,
      infrastructureScore: score.infrastructureScore,
      treeHealthScore: score.treeHealthScore,
      ndviValue: score.ndviValue ?? "",
      note: "",
    });
  }
  return results;
}

async function main() {
  const xmlArg = process.argv[2];
  const outCsvArg = process.argv[3] || "scripts/appeears_points.csv";
  if (!xmlArg) {
    throw new Error("Usage: node scripts/process-appeears-xml.js <metadata-xml> [points-csv-output]");
  }

  const xmlPath = path.resolve(process.cwd(), xmlArg);
  const outCsvPath = path.resolve(process.cwd(), outCsvArg);
  const gshiCsvPath = outCsvPath.replace(/\.csv$/i, "-gshi.csv");

  const xml = fs.readFileSync(xmlPath, "utf8");
  const rows = parseMetadataXml(xml);
  if (!rows.length) {
    throw new Error("No points found in XML. Check if this is an AppEEARS metadata XML.");
  }

  fs.writeFileSync(
    outCsvPath,
    toCsv(rows, ["park_key", "park_name", "lat", "lng", "start_date", "end_date", "product"]),
    "utf8",
  );

  const gshiRows = await calculateForRows(rows);
  fs.writeFileSync(
    gshiCsvPath,
    toCsv(gshiRows, [
      "park_name",
      "park_id",
      "matched",
      "overallScore",
      "vegetationScore",
      "thermalScore",
      "waterScore",
      "biodiversityScore",
      "infrastructureScore",
      "treeHealthScore",
      "ndviValue",
      "note",
    ]),
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        pointsExtracted: rows.length,
        pointsCsv: path.relative(process.cwd(), outCsvPath),
        gshiCsv: path.relative(process.cwd(), gshiCsvPath),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
