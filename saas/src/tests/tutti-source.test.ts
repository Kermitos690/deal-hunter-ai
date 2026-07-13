import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tuttiAdapter } from "@/sources/tutti.adapter";
import type { Radar } from "@/types";

const radar: Radar = {
  id: "radar-tutti",
  user_id: "user-1",
  name: "Omega",
  category: "Montres",
  brands: ["Omega"],
  models: [],
  include_keywords: [],
  exclude_keywords: [],
  source_countries: ["CH"],
  target_country: "CH",
  max_buy_price: 1000,
  min_profit: 1,
  min_roi_percent: 0,
  min_score: 0,
  accepted_conditions: ["A", "B"],
  sale_types: ["BUY_NOW"],
  sources: ["tutti"],
  shipping_cost: 0,
  customs_cost: 0,
  vat_rate: 0,
  platform_fee_rate: 0.12,
  payment_fee_rate: 0.03,
  repair_cost: 0,
  scan_frequency_minutes: 360,
  alerts_enabled: true,
  photos_required: true,
  auction_mode: false,
  auction_reminder_enabled: false,
  is_active: true
};

const originalEnabled = tuttiAdapter.enabled;

describe("Tutti source", () => {
  beforeEach(() => {
    // The adapter is disabled by default in production. These unit tests enable
    // the isolated adapter instance explicitly without changing environment defaults.
    tuttiAdapter.enabled = true;
  });

  afterEach(() => {
    tuttiAdapter.enabled = originalEnabled;
    vi.restoreAllMocks();
  });

  it("ne retourne que les annonces détail actives avec prix", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const href = String(url);
      if (href.includes("/fr/q?query=")) {
        return new Response(`
          <div data-private-srp-listing-item-id="81830566">
            <a href="/fr/vi/geneve/vetements-accessoires/montres-bijoux/omega-vintage/81830566">
              <img aria-label="Omega Vintage" src="https://c.tutti.ch/thumbnail/7991841365.jpg" />
            </a>
            <h2><a href="/fr/vi/geneve/vetements-accessoires/montres-bijoux/omega-vintage/81830566"><div>Omega Vintage</div></a></h2>
            <span>499.-</span>
          </div>
        `);
      }
      return new Response(`
        <html><head>
          <title>Omega Vintage Canton Genève - tutti.ch</title>
          <meta name="description" content="Omega Genève Vintage calibre 613" />
          <meta name="robots" content="index,follow" />
          <meta property="og:image:secure_url" content="https://c.tutti.ch/big/7991841365.jpg" />
        </head><body>
          <button aria-label="mark as favorite">favori</button>
          <h1>Omega Vintage</h1>
          <span>499.-</span>
        </body></html>
      `);
    });
    const items = await tuttiAdapter.scan(radar);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      source: "tutti",
      sourceItemId: "81830566",
      priceAmount: 499,
      priceCurrency: "CHF",
      saleType: "BUY_NOW"
    });
    expect(items[0].rawPayload?.activeVerified).toBe(true);
  });

  it("rejette les pages détail vendues ou supprimées", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const href = String(url);
      if (href.includes("/fr/q?query=")) {
        return new Response(`
          <div data-private-srp-listing-item-id="81830566">
            <a href="/fr/vi/geneve/vetements-accessoires/montres-bijoux/omega-vintage/81830566">Omega</a>
            <span>499.-</span>
          </div>
        `);
      }
      return new Response("<html><body><h1>Omega</h1><span>499.-</span>Déjà vendu</body></html>");
    });
    await expect(tuttiAdapter.scan(radar)).resolves.toEqual([]);
  });
});
