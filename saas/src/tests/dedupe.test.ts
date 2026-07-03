import { describe, expect, it } from "vitest";
import { normalizeUrl, productFingerprint } from "@/lib/dedupe";
import { mockCandidates } from "@/sources/mock.adapter";
describe("anti-doublons", () => {
  it("retire les traceurs URL", () => expect(normalizeUrl("https://EXAMPLE.com/a/?utm_source=x")).toBe("https://example.com/a"));
  it("produit une empreinte stable", () => expect(productFingerprint(mockCandidates[0])).toBe(productFingerprint({...mockCandidates[0]})));
});
