import { describe, expect, it } from "vitest";
import { RADAR_TEMPLATES, radarTemplate } from "@/lib/radars/templates";

describe("radar templates", () => {
  it("fournit des identifiants uniques et des critères supportés", () => {
    expect(new Set(RADAR_TEMPLATES.map((item) => item.id)).size).toBe(RADAR_TEMPLATES.length);
    expect(RADAR_TEMPLATES.length).toBeGreaterThanOrEqual(10);
    for (const template of RADAR_TEMPLATES) {
      expect(template.accepted_conditions.length).toBeGreaterThan(0);
      expect(template.sale_types.every((type) => ["BUY_NOW", "AUCTION"].includes(type))).toBe(true);
    }
    expect(radarTemplate("lv-vintage")?.brands).toContain("Louis Vuitton");
    expect(radarTemplate("pokemon-modern-2025-2026")?.models).toContain("tcg:year:2026");
    expect(radarTemplate("pokemon-graded")?.models).toContain("tcg:min-grade:8");
    expect(radarTemplate("pokemon-sealed")?.models).toContain("tcg:type:SEALED_PRODUCT");
    expect(radarTemplate("pokemon-shop-lots")?.min_profit).toBeGreaterThanOrEqual(100);
    expect(radarTemplate("inconnu")).toBeUndefined();
  });
});
