import { describe, expect, it } from "vitest";
import { ebayConditionGrade } from "@/sources/ebay.adapter";

describe("source eBay", () => {
  it("normalise les états eBay", () => {
    expect(ebayConditionGrade("New with tags")).toBe("NEW");
    expect(ebayConditionGrade("Pre-owned - Good")).toBe("B");
    expect(ebayConditionGrade("For parts or not working")).toBe("REPAIR");
  });
});
