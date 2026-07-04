import { describe, expect, it } from "vitest";
import { summarizeSourceLogs } from "@/lib/admin/source-health";

describe("source health", () => {
  it("agrège succès, erreurs, candidats et durée", () => {
    const result=summarizeSourceLogs([
      {source:"ebay",status:"success",candidates_found:10,duration_ms:1000,started_at:"2026-07-04T10:00:00Z",finished_at:"2026-07-04T10:00:01Z"},
      {source:"ebay",status:"error",candidates_found:0,duration_ms:3000,error_message:"timeout",started_at:"2026-07-04T11:00:00Z",finished_at:"2026-07-04T11:00:03Z"}
    ]);
    expect(result[0]).toMatchObject({source:"ebay",scans:2,successes:1,errors:1,candidates:10,averageDurationMs:2000,lastError:"timeout"});
  });
});
