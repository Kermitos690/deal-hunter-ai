import { afterEach, describe, expect, it } from "vitest";
import { configuredSources, summarizeSourceLogs } from "@/lib/admin/source-health";

const ENV_KEYS = [
  "LIVE_SOURCE_PROXY_URL",
  "SWISS_SOURCE_PROXY_URL",
  "ENABLE_MOCK_SOURCE",
  "ENABLE_EBAY_SOURCE",
  "EBAY_CLIENT_ID",
  "EBAY_CLIENT_SECRET",
  "ENABLE_RICARDO_SOURCE",
  "ENABLE_ANIBIS_SOURCE",
  "ENABLE_TUTTI_SOURCE",
  "ENABLE_KOMEHYO_SOURCE"
] as const;

const originalEnvironment = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

describe("source health", () => {
  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = originalEnvironment[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("agrège succès, erreurs, candidats et durée", () => {
    const result = summarizeSourceLogs([
      { source: "ebay", status: "success", candidates_found: 10, duration_ms: 1000, started_at: "2026-07-04T10:00:00Z", finished_at: "2026-07-04T10:00:01Z" },
      { source: "ebay", status: "error", candidates_found: 0, duration_ms: 3000, error_message: "timeout", started_at: "2026-07-04T11:00:00Z", finished_at: "2026-07-04T11:00:03Z" }
    ]);
    expect(result[0]).toMatchObject({
      source: "ebay",
      health: "degraded",
      scans: 2,
      successes: 1,
      errors: 1,
      candidates: 10,
      averageDurationMs: 2000,
      lastError: "timeout"
    });
  });

  it("distingue limitation de débit et erreur d’authentification", () => {
    const result = summarizeSourceLogs([
      { source: "ebay", status: "error", candidates_found: 0, duration_ms: 100, error_message: "HTTP 429 rate limit", started_at: "2026-07-04T12:00:00Z", finished_at: "2026-07-04T12:00:01Z" },
      { source: "email-alerts", status: "error", candidates_found: 0, duration_ms: 100, error_message: "401 unauthorized", started_at: "2026-07-04T12:00:00Z", finished_at: "2026-07-04T12:00:01Z" }
    ]);
    expect(result.find((item) => item.source === "ebay")?.health).toBe("rate_limited");
    expect(result.find((item) => item.source === "email-alerts")?.health).toBe("auth_error");
  });

  it("garde les sources externes désactivées sans activation explicite", () => {
    delete process.env.ENABLE_EBAY_SOURCE;
    delete process.env.ENABLE_RICARDO_SOURCE;
    delete process.env.ENABLE_ANIBIS_SOURCE;
    delete process.env.ENABLE_TUTTI_SOURCE;
    delete process.env.ENABLE_KOMEHYO_SOURCE;

    const sources = configuredSources();
    expect(sources.find((source) => source.source === "ebay")?.status).toBe("disabled");
    expect(sources.find((source) => source.source === "ricardo")?.status).toBe("disabled");
    expect(sources.find((source) => source.source === "komehyo")?.status).toBe("disabled");
  });

  it("marque eBay mal configuré quand la source est activée sans OAuth", () => {
    process.env.ENABLE_EBAY_SOURCE = "true";
    delete process.env.EBAY_CLIENT_ID;
    delete process.env.EBAY_CLIENT_SECRET;

    expect(configuredSources().find((source) => source.source === "ebay")?.status).toBe("misconfigured");
  });

  it("signale le risque 403 quand le proxy live suisse n'est pas configuré", () => {
    process.env.ENABLE_RICARDO_SOURCE = "true";
    delete process.env.LIVE_SOURCE_PROXY_URL;
    delete process.env.SWISS_SOURCE_PROXY_URL;

    const ricardo = configuredSources().find((source) => source.source === "ricardo");

    expect(ricardo?.detail).toContain("risque HTTP 403");
  });

  it("signale le proxy live configuré dans la santé des sources suisses", () => {
    process.env.ENABLE_TUTTI_SOURCE = "true";
    process.env.LIVE_SOURCE_PROXY_URL = "http://proxy.example:8080";

    const tutti = configuredSources().find((source) => source.source === "tutti");

    expect(tutti?.detail).toContain("Proxy live configuré");
  });
});
