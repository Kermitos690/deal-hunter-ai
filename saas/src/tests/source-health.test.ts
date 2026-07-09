import { afterEach, describe, expect, it } from "vitest";
import { configuredSources, summarizeSourceLogs } from "@/lib/admin/source-health";

describe("source health", () => {
  const originalLiveProxy = process.env.LIVE_SOURCE_PROXY_URL;
  const originalSwissProxy = process.env.SWISS_SOURCE_PROXY_URL;

  afterEach(() => {
    process.env.LIVE_SOURCE_PROXY_URL = originalLiveProxy;
    process.env.SWISS_SOURCE_PROXY_URL = originalSwissProxy;
  });

  it("agrège succès, erreurs, candidats et durée", () => {
    const result=summarizeSourceLogs([
      {source:"ebay",status:"success",candidates_found:10,duration_ms:1000,started_at:"2026-07-04T10:00:00Z",finished_at:"2026-07-04T10:00:01Z"},
      {source:"ebay",status:"error",candidates_found:0,duration_ms:3000,error_message:"timeout",started_at:"2026-07-04T11:00:00Z",finished_at:"2026-07-04T11:00:03Z"}
    ]);
    expect(result[0]).toMatchObject({source:"ebay",scans:2,successes:1,errors:1,candidates:10,averageDurationMs:2000,lastError:"timeout"});
  });

  it("signale le risque 403 quand le proxy live suisse n'est pas configuré", () => {
    delete process.env.LIVE_SOURCE_PROXY_URL;
    delete process.env.SWISS_SOURCE_PROXY_URL;

    const ricardo = configuredSources().find((source) => source.source === "ricardo");

    expect(ricardo?.detail).toContain("risque HTTP 403");
  });

  it("signale le proxy live configuré dans la santé des sources suisses", () => {
    process.env.LIVE_SOURCE_PROXY_URL = "http://proxy.example:8080";

    const tutti = configuredSources().find((source) => source.source === "tutti");

    expect(tutti?.detail).toContain("Proxy live configuré");
  });
});
