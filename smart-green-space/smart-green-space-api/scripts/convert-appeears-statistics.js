const fs = require("fs");
const path = require("path");

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

function csvEscape(value) {
  const v = value == null ? "" : String(value);
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function toCsv(rows, columns) {
  return [
    columns.join(","),
    ...rows.map((row) => columns.map((c) => csvEscape(row[c])).join(",")),
  ].join("\n");
}

async function main() {
  const inputArg = process.argv[2];
  const outputArg = process.argv[3] || "data/appeears-ndvi-from-statistics.csv";
  if (!inputArg) {
    throw new Error(
      "Usage: node scripts/convert-appeears-statistics.js <MOD13Q1-061-Statistics.csv> [output-csv]",
    );
  }

  const inputPath = path.resolve(process.cwd(), inputArg);
  const outputPath = path.resolve(process.cwd(), outputArg);
  const raw = fs.readFileSync(inputPath, "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) throw new Error("Input CSV appears empty.");

  const headers = parseCsvLine(lines[0]);
  const idx = Object.fromEntries(headers.map((h, i) => [h, i]));
  const required = ["Dataset", "aid", "Date", "Mean", "Minimum", "Maximum"];
  for (const key of required) {
    if (idx[key] == null) throw new Error(`Missing '${key}' column.`);
  }

  const aidToPark = {
    aid0001: "lodhi_garden",
    aid0002: "nehru_park",
    aid0003: "deer_park_hauz_khas",
    aid0004: "garden_of_five_senses",
    aid0005: "central_park_connaught_place",
  };

  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const row = parseCsvLine(lines[i]);
    const dataset = row[idx.Dataset] || "";
    if (!dataset.includes("_NDVI")) continue;

    const aid = row[idx.aid];
    rows.push({
      park_key: aidToPark[aid] || aid,
      date: row[idx.Date],
      ndvi_mean: toNum(row[idx.Mean]),
      ndvi_min: toNum(row[idx.Minimum]),
      ndvi_max: toNum(row[idx.Maximum]),
      cloud_coverage: "",
      image_url: "",
      ndvi_map_url: "",
      thermal_map_url: "",
    });
  }

  fs.writeFileSync(
    outputPath,
    toCsv(rows, [
      "park_key",
      "date",
      "ndvi_mean",
      "ndvi_min",
      "ndvi_max",
      "cloud_coverage",
      "image_url",
      "ndvi_map_url",
      "thermal_map_url",
    ]),
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        input: path.relative(process.cwd(), inputPath),
        output: path.relative(process.cwd(), outputPath),
        rows: rows.length,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
