import fs from "fs";
import path from "path";
import { handleBuild } from "./builder.js";
import { initEcc } from "./compat.js";

function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    const out = { ok: false, error: { code: "INVALID_ARGS", message: "Usage: cli <fixture> <output>" } };
    console.error("Error: INVALID_ARGS");
    console.log(JSON.stringify(out));
    process.exit(1);
  }

  const fixturePath = args[0];
  const outputPath = args[1];

  try {
    initEcc();
    const raw = fs.readFileSync(fixturePath, "utf-8");
    const fixture = JSON.parse(raw);
    const report = handleBuild(fixture);

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(report));

    if (!report.ok) {
      console.error(`Error: ${report.error.code}: ${report.error.message}`);
      process.exit(1);
    }
  } catch (err) {
    const report = { ok: false, error: { code: "INTERNAL_ERROR", message: err instanceof Error ? err.message : "Unknown error" } };
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(report));
    console.error(`Error: INTERNAL_ERROR: ${report.error.message}`);
    process.exit(1);
  }
}

main();
