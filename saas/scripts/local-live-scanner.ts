import { runLocalLiveSourceScans } from "../src/lib/scans/run-radar-scan";

async function main() {
  const startedAt = new Date();
  console.log(`[local-live-scanner] Début ${startedAt.toISOString()}`);
  console.log("[local-live-scanner] Sources locales ciblées: ricardo, anibis, tutti");

  const results = await runLocalLiveSourceScans();
  const summary = {
    processed: results.length,
    ok: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    skipped: results.filter((result) => "skipped" in result && result.skipped).length,
    alertsSent: results.reduce((sum, result) => sum + ("alertsSent" in result && typeof result.alertsSent === "number" ? result.alertsSent : 0), 0),
    candidatesFound: results.reduce((sum, result) => sum + ("candidatesFound" in result && typeof result.candidatesFound === "number" ? result.candidatesFound : 0), 0)
  };

  console.log(JSON.stringify({ summary, results }, null, 2));
  console.log(`[local-live-scanner] Fin ${new Date().toISOString()}`);
}

main().catch((error) => {
  console.error("[local-live-scanner] Échec:", error instanceof Error ? error.message : error);
  process.exit(1);
});
