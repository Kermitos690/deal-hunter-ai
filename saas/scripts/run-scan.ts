import { runRadarScan, runDueScans } from "../src/lib/scans/run-radar-scan";
const radarId = process.argv[2];
console.log(radarId ? await runRadarScan(radarId) : await runDueScans());
