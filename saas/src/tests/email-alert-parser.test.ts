import { describe, expect, it, vi } from "vitest";
import { bestMarketplaceUrl, extractPrice, parseEmailAlertToCandidate, senderAllowed } from "@/sources/email-alert-parser";
import type { Radar } from "@/types";

const radar = {
  id: "radar",
  user_id: "user",
  name: "Nike radar",
  category: "Sneakers",
  brands: ["Nike"],
  models: ["Dunk"],
  include_keywords: [],
  exclude_keywords: [],
  source_countries: [],
  target_country: "CH",
  max_buy_price: 500,
  total_budget: 500,
  accepted_conditions: ["NEW", "A", "B", "UNKNOWN"],
  sale_types: ["BUY_NOW", "AUCTION"],
  sources: ["email-alerts"],
  shipping_cost: 0,
  customs_cost: 0,
  vat_rate: 0,
  import_tax_rate: 0,
  platform_fee_rate: 0,
  payment_fee_rate: 0,
  repair_cost: 0,
  min_profit: 1,
  min_roi_percent: 0,
  min_score: 0,
  scan_frequency_minutes: 30,
  alerts_enabled: true,
  photos_required: false,
  auction_mode: false,
  auction_reminder_enabled: false,
  is_active: true
} as Radar;

describe("email alert parser", () => {
  it("extrait les prix suisses et européens", () => {
    expect(extractPrice("Prix CHF 1'250")).toEqual({ amount: 1250, currency: "CHF" });
    expect(extractPrice("Seulement € 99,90")).toEqual({ amount: 99.9, currency: "EUR" });
  });

  it("choisit un lien marketplace plutôt qu’un lien de désinscription", () => {
    expect(bestMarketplaceUrl([
      "https://example.com/unsubscribe",
      "https://www.ebay.ch/itm/123"
    ])).toBe("https://www.ebay.ch/itm/123");
  });

  it("respecte la allow-list d’expéditeurs", () => {
    expect(senderAllowed("alerts@ebay.ch", ["ebay.ch"])).toBe(true);
    expect(senderAllowed("alerts@sub.ebay.ch", ["ebay.ch"])).toBe(true);
    expect(senderAllowed("alerts@fakeebay.ch", ["ebay.ch"])).toBe(false);
    expect(senderAllowed("spam@example.com", ["ebay.ch"])).toBe(false);
  });

  it("transforme une alerte email en candidate exploitable", () => {
    vi.stubEnv("EMAIL_ALLOWED_SENDERS", "");
    const candidate = parseEmailAlertToCandidate({
      subject: "Nike Dunk Low nouvelle annonce",
      text: "Nike Dunk Low disponible CHF 180 https://www.ebay.ch/itm/123",
      html: "<img src=\"https://i.ebayimg.com/image.jpg\">"
    } as any, radar, { uid: 42, sender: "alerts@ebay.ch" });
    expect(candidate).toMatchObject({
      source: "email:ebay",
      sourceItemId: "imap-42",
      priceAmount: 180,
      priceCurrency: "CHF",
      productUrl: "https://www.ebay.ch/itm/123"
    });
    vi.unstubAllEnvs();
  });
});
