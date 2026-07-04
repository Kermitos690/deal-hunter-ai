import { describe, expect, it, vi } from "vitest";
import { komehyoAdapter, komehyoConditionGrade, parseKomehyoHtml } from "@/sources/komehyo.adapter";
import { radar } from "./fixtures";

const fixture = `
<ul class="result-list">
  <li class="p-lists__item">
    <input type="hidden" name="goodsNo" value="4054980">
    <a class="p-link p-link--card" href="/product/270-004-305-4449/">
      <img src="https://img.komehyo.jp/contents/images/goods/162/item.jpg"
        alt="オメガ シーマスター 231.10.42.21.03.004 SS 自動巻">
      <span class="p-link__txt--productsname">オメガ シーマスター &quot;007&quot; 231.10.42.21.03.004 SS 自動巻</span>
      <span class="p-link__txt--brand">OMEGA</span>
      <span class="p-link__txt--rank">ランク：<span class="p-link__txt--rating">中古品A</span></span>
      <span class="p-link__txt--price p-link__txt--price-sale">￥750,000<span>税込</span></span>
    </a>
  </li>
</ul>`;

describe("source KOMEHYO", () => {
  it("normalise les rangs japonais", () => {
    expect(komehyoConditionGrade("新品")).toBe("NEW");
    expect(komehyoConditionGrade("ランク：中古品A")).toBe("A");
    expect(komehyoConditionGrade("中古品Ｂ")).toBe("B");
  });

  it("extrait une annonce active en JPY", () => {
    const [item] = parseKomehyoHtml(fixture, {
      brands: ["Omega"], models: [], category: "Montres"
    });
    expect(item).toMatchObject({
      source: "komehyo",
      sourceItemId: "4054980",
      brand: "Omega",
      model: "231.10.42.21.03.004",
      priceAmount: 750000,
      priceCurrency: "JPY",
      conditionGrade: "A",
      itemCountry: "JP"
    });
    expect(item.title).toContain("\"007\"");
    expect(item.productUrl).toBe("https://komehyo.jp/product/270-004-305-4449/");
    expect(item.imageUrls).toHaveLength(1);
  });

  it("conserve les autres marques lorsqu'une requête échoue", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response("", { status: 500 }))
      .mockResolvedValueOnce(new Response(fixture.padEnd(1_200, " "), { status: 200 })));
    const items = await komehyoAdapter.scan({
      ...radar, brands: ["Prada", "Omega"], sources: ["komehyo"]
    });
    expect(items).toHaveLength(1);
    expect(items[0].sourceItemId).toBe("4054980");
    vi.unstubAllGlobals();
  });
});
