import { describe, expect, it } from "vitest";
import { normalizeMarketText, normalizeReference } from "@/market/normalize-comparable";

describe("comparable normalization", () => {
  it("normalise espaces unicode et références", () => {
    expect(normalizeMarketText("  Omega   Seamaster  ")).toBe("Omega Seamaster");
    expect(normalizeReference(" 136.005 / abc ")).toBe("136.005-ABC");
    expect(normalizeReference(null)).toBeNull();
  });
});
