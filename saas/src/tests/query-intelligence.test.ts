import { describe, expect, it } from "vitest";
import {
  buildIntelligentQueries,
  detectQueryIntents,
  intelligentSearchQueries,
  isIntelligentlyRelevantListing,
} from "@/lib/query-intelligence";

const mascotGlassesRadar = {
  category: "Accessoires",
  brands: [],
  models: [],
  include_keywords: ["lunettes mascotte"],
};

describe("query intelligence engine", () => {
  it("detects combined eyewear and costume intent", () => {
    expect(detectQueryIntents(mascotGlassesRadar).map((intent) => intent.id)).toEqual(
      expect.arrayContaining(["eyewear", "costume"]),
    );
  });

  it("expands a French niche request into seller vocabulary and languages", () => {
    const queries = intelligentSearchQueries(mascotGlassesRadar, 24).map((query) => query.toLowerCase());

    expect(queries).toContain("lunettes mascotte accessoires");
    expect(queries.some((query) => query.includes("costume accessory"))).toBe(true);
    expect(queries.some((query) => query.includes("cosplay accessory"))).toBe(true);
    expect(queries.some((query) => query.includes("glasses") || query.includes("eyewear"))).toBe(true);
    expect(new Set(queries).size).toBe(queries.length);
  });

  it("keeps exact queries first and marks wider discovery queries", () => {
    const plan = buildIntelligentQueries(mascotGlassesRadar, 24);

    expect(plan[0]).toMatchObject({ query: "lunettes mascotte Accessoires", precision: "exact" });
    expect(plan.some((item) => item.precision === "expanded")).toBe(true);
    expect(plan.every((item) => item.intentIds.includes("eyewear") && item.intentIds.includes("costume"))).toBe(true);
  });

  it("works for an unknown product without a product-specific rule", () => {
    const queries = intelligentSearchQueries({
      category: "Jouets",
      brands: [],
      models: [],
      include_keywords: ["robot télécommandé dinosaure"],
    });

    expect(queries).toContain("robot télécommandé dinosaure Jouets");
    expect(queries.some((query) => /toy|spielzeug|giocattoli/i.test(query))).toBe(true);
  });

  it("filters generic discovery noise while retaining relevant titles", () => {
    expect(isIntelligentlyRelevantListing(
      "Funny mascot costume glasses cosplay party accessory",
      mascotGlassesRadar,
    )).toBe(true);
    expect(isIntelligentlyRelevantListing(
      "Kitchen replacement filter set",
      mascotGlassesRadar,
    )).toBe(false);
  });
});
