import { describe, expect, it } from "vitest";
import {
  absoluteProfitScoreCap,
  enrichPokemonCandidate,
  expandPokemonRadarForSources,
  isRelevantPokemonListing,
  parsePokemonTcgTitle,
  pokemonCandidateMismatchReasons,
  pokemonRadarConfigFromModels,
  pokemonRadarDirectives
} from "@/lib/tcg/pokemon";
import type { ProductCandidate, Radar } from "@/types";
import { radar as baseRadar } from "./fixtures";

const pokemonRadar = (changes: Partial<Radar> = {}): Radar => ({
  ...baseRadar,
  name: "Pokémon test",
  category: "Cartes à collectionner",
  brands: ["Pokémon"],
  models: [],
  include_keywords: [],
  exclude_keywords: ["proxy", "fake"],
  accepted_conditions: ["NEW", "A", "B", "C", "UNKNOWN"],
  ...changes
});

const candidate = (title: string): ProductCandidate => enrichPokemonCandidate({
  source: "ebay",
  sourceItemId: title,
  title,
  category: "Cartes à collectionner",
  priceAmount: 100,
  priceCurrency: "CHF",
  conditionGrade: "B",
  productUrl: "https://example.test/card",
  imageUrls: ["https://example.test/card.jpg"]
});

describe("Pokémon TCG vertical", () => {
  it("structure un slab avec set, numéro, grade et langue", () => {
    const parsed = parsePokemonTcgTitle("Pokemon Prismatic Evolutions Umbreon ex 161/131 English PSA 10 cert 12345678");
    expect(parsed.productType).toBe("GRADED_CARD");
    expect(parsed.gradingCompany).toBe("PSA");
    expect(parsed.grade).toBe(10);
    expect(parsed.certificationNumber).toBe("12345678");
    expect(parsed.cardNumber).toBe("161/131");
    expect(parsed.setName).toBe("Prismatic Evolutions");
    expect(parsed.releaseYear).toBe(2025);
    expect(parsed.language).toBe("EN");
  });

  it("reconnaît les produits scellés récents", () => {
    const parsed = parsePokemonTcgTitle("Pokemon Mega Evolution Perfect Order Elite Trainer Box factory sealed French 2026");
    expect(parsed.productType).toBe("SEALED_PRODUCT");
    expect(parsed.isSealed).toBe(true);
    expect(parsed.setName).toBe("Perfect Order");
    expect(parsed.releaseYear).toBe(2026);
    expect(parsed.isRecentRelease).toBe(true);
    expect(parsed.language).toBe("FR");
  });

  it("bloque les proxies, codes et faux produits", () => {
    const radar = pokemonRadar();
    expect(isRelevantPokemonListing("Pokemon Charizard proxy custom card", radar)).toBe(false);
    expect(isRelevantPokemonListing("Pokemon TCG Live code card", radar)).toBe(false);
    expect(isRelevantPokemonListing("Pokemon Charizard 4/102 holo near mint", radar)).toBe(true);
  });

  it("encode les filtres métier sans migration de schéma", () => {
    const directives = pokemonRadarDirectives({
      productTypes: ["GRADED_CARD"],
      gradingCompanies: ["PSA", "BGS"],
      minimumGrade: 9,
      languages: ["FR", "EN"],
      releaseYears: [2025, 2026],
      includeUngraded: false
    });
    const parsed = pokemonRadarConfigFromModels(directives);
    expect(parsed.productTypes).toEqual(["GRADED_CARD"]);
    expect(parsed.gradingCompanies).toEqual(["PSA", "BGS"]);
    expect(parsed.minimumGrade).toBe(9);
    expect(parsed.languages).toEqual(["FR", "EN"]);
    expect(parsed.releaseYears).toEqual([2025, 2026]);
    expect(parsed.includeUngraded).toBe(false);
  });

  it("applique type, grader et grade minimum", () => {
    const radar = pokemonRadar({
      models: ["tcg:type:GRADED_CARD", "tcg:grader:PSA", "tcg:min-grade:9"]
    });
    expect(pokemonCandidateMismatchReasons(candidate("Pokemon Charizard Base Set PSA 10 4/102"), radar)).toEqual([]);
    expect(pokemonCandidateMismatchReasons(candidate("Pokemon Charizard Base Set PSA 8 4/102"), radar)).toContain("pokemon_grade_too_low");
    expect(pokemonCandidateMismatchReasons(candidate("Pokemon Charizard Base Set raw NM 4/102"), radar)).toContain("pokemon_product_type_not_accepted");
  });

  it("élargit les requêtes sources pour sets, grades et scellé", () => {
    const expanded = expandPokemonRadarForSources(pokemonRadar({
      models: [
        "tcg:type:GRADED_CARD",
        "tcg:type:SEALED_PRODUCT",
        "tcg:grader:PSA",
        "tcg:set:Prismatic Evolutions",
        "tcg:year:2025"
      ]
    }));
    expect(expanded.models.some((model) => /Prismatic Evolutions/i.test(model))).toBe(true);
    expect(expanded.models.some((model) => /PSA/i.test(model))).toBe(true);
    expect(expanded.models.some((model) => /sealed|booster|elite trainer/i.test(model))).toBe(true);
    expect(expanded.models.some((model) => model.startsWith("tcg:"))).toBe(false);
  });

  it("empêche un profit minuscule de produire un score élevé", () => {
    expect(absoluteProfitScoreCap(2)).toBe(39);
    expect(absoluteProfitScoreCap(23)).toBe(54);
    expect(absoluteProfitScoreCap(49)).toBe(69);
    expect(absoluteProfitScoreCap(50)).toBe(100);
  });
});
