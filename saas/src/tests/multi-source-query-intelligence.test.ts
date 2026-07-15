import { describe, expect, it } from "vitest";
import { isMarketplaceRelevantListing } from "@/lib/query-intelligence";
import { anibisSearchQueries } from "@/sources/anibis.adapter";
import { komehyoSearchQueries } from "@/sources/komehyo.adapter";
import { ricardoSearchQueries } from "@/sources/ricardo.adapter";
import { tuttiSearchQueries } from "@/sources/tutti.adapter";

const nicheRadar = {
  brands: [],
  models: [],
  include_keywords: ["lunettes mascotte"],
  category: "Accessoires",
};

const sourceQueryBuilders = [
  ["Ricardo", ricardoSearchQueries],
  ["Anibis", anibisSearchQueries],
  ["Tutti", tuttiSearchQueries],
  ["Komehyo", komehyoSearchQueries],
] as const;

describe("query intelligence multi-sources", () => {
  for (const [source, buildQueries] of sourceQueryBuilders) {
    it(`développe le radar lunettes mascotte sur ${source}`, () => {
      const queries = buildQueries(nicheRadar);
      expect(queries.length).toBeGreaterThan(3);
      expect(queries.length).toBeLessThanOrEqual(6);
      expect(queries[0]).toContain("lunettes mascotte");
      expect(queries.some((query) => /glasses mascot/i.test(query))).toBe(true);
      expect(new Set(queries.map((query) => query.toLowerCase())).size).toBe(queries.length);
    });
  }

  it("accepte un titre vendeur multilingue qui satisfait les deux intentions", () => {
    expect(isMarketplaceRelevantListing(
      "Funny mascot glasses for cosplay costume party",
      nicheRadar,
    )).toBe(true);
  });

  it("rejette des lunettes ordinaires sans signal mascotte ou déguisement", () => {
    expect(isMarketplaceRelevantListing(
      "Oakley sports sunglasses polarized black",
      nicheRadar,
    )).toBe(false);
  });

  it("conserve le filtre spécialisé des montres complètes", () => {
    const watchRadar = {
      brands: ["Omega"],
      models: ["Seamaster"],
      include_keywords: [],
      category: "Montres",
    };
    expect(isMarketplaceRelevantListing("Omega Seamaster automatic wristwatch", watchRadar)).toBe(true);
    expect(isMarketplaceRelevantListing("Omega Seamaster replacement watch crystal", watchRadar)).toBe(false);
  });
});
