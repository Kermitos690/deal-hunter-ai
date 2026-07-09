import { runRadarScan, runDueScans } from "../src/lib/scans/run-radar-scan";
const radarId = process.argv[2];
async function main() {
  console.log(radarId ? await runRadarScan(radarId) : await runDueScans());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
