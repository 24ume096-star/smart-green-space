const { execSync } = require("child_process");
const path = require("path");

function run(script) {
  console.log(`\n🚀 Running: ${script}...`);
  try {
    const output = execSync(`node scripts/${script}`, {
      stdio: "inherit",
      cwd: path.join(__dirname, ".."),
    });
  } catch (err) {
    console.error(`❌ Failed: ${script}`);
    process.exit(1);
  }
}

async function main() {
  console.log("========================================");
  console.log("   SGS SYSTEM RE-INITIALIZATION        ");
  console.log("========================================");

  run("add-delhi-parks.js");
  run("seed-delhi-ndvi.js");
  run("seed-delhi-telemetry.js");
  run("calculate-delhi-gshi.js");

  console.log("\n✅ All systems green. Data initialized.");
}

main().catch(console.error);
