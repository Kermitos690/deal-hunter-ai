import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../supabase/migrations/20260713235500_channels_and_sponsored_placements.sql", import.meta.url),
  "utf8"
);

describe("channels and sponsored placements migration", () => {
  it("contains no temporary or invalid migration marker", () => {
    expect(migration).not.toContain("placeholder");
    expect(migration).not.toContain("foreach_trigger");
  });

  it("keeps sponsorship in separate tables and functions", () => {
    expect(migration).toContain("create table if not exists public.sponsored_campaigns");
    expect(migration).toContain("create table if not exists public.sponsored_impressions");
    expect(migration).toContain("create table if not exists public.sponsored_clicks");
    expect(migration).toContain("disclosure_label text not null default 'Sponsorisé'");
    expect(migration).not.toMatch(/update\s+public\.deal_scores/i);
    expect(migration).not.toMatch(/alter\s+table\s+public\.deal_scores/i);
  });

  it("restricts writes to service-role RPCs and enables RLS", () => {
    expect(migration).toContain("alter table public.sponsored_campaigns enable row level security");
    expect(migration).toContain("grant execute on function public.record_sponsored_impression");
    expect(migration).toContain("grant execute on function public.record_sponsored_click");
    expect(migration).toContain("to service_role");
  });
});
