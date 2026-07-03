import { describe, expect, it } from "vitest";
import { radar } from "@/tests/fixtures";
import { mockAdapter } from "@/sources/mock.adapter";

describe("source mock", () => {
  it("fait correspondre les marques sans dépendre des accents", async () => {
    const results = await mockAdapter.scan({
      ...radar,
      category: "Montres",
      brands: ["Oméga", "TAG Heuer"],
      accepted_conditions: ["B", "REPAIR"]
    });

    expect(results.map((item) => item.sourceItemId)).toEqual(
      expect.arrayContaining(["tag-vintage-002", "omega-repair-003"])
    );
  });
});
