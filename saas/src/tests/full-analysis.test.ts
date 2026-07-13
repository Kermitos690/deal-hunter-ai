import { describe, expect, it } from "vitest";
import { formatFullDealAnalysis } from "@/telegram/full-analysis";

const product = {
  title: "Vintage Seiko Slim Tank Quartz Red Dial 26MM Men's Watch H24",
  brand: "Seiko",
  model: null,
  category: "Montres",
  source: "ebay",
  price_amount: 38,
  condition_grade: "UNKNOWN",
  description: "Vintage watch, untested",
  product_url: "https://example.com/seiko"
};

const score = {
  recommendation: "WATCH",
  total_score: 64,
  scoring_version: "v6",
  estimated_buy_cost: 40,
  estimated_resale_price: 44,
  estimated_net_profit: 4,
  estimated_roi_percent: 10.3,
  maximum_offer: 30,
  break_even_resale_price: 42,
  market_confidence: "LOW",
  warnings: ["Confiance marché faible"],
  reasons: ["Marge nette estimée à 4 CHF."],
  action_plan: "Ne pas dépasser 30 CHF."
};

describe("formatFullDealAnalysis", () => {
  it("sépare les ventes conclues des annonces actives", () => {
    const report = formatFullDealAnalysis(product, score, [
      {
        source: "ricardo_active_listing",
        title: "Seiko tank quartz active",
        price: 90,
        currency: "CHF",
        evidence_url: "https://example.com/ricardo-active",
        match_score: 0.75
      },
      {
        source: "ebay_sold",
        evidence_type: "SOLD",
        title: "Seiko tank quartz sold",
        price: 65,
        currency: "CHF",
        sold_at: "2026-06-01",
        evidence_url: "https://example.com/ebay-sold",
        match_score: 0.9
      }
    ]);

    expect(report).toContain("1 vente(s) conclue(s) suffisamment proche(s)");
    expect(report).toContain("1 annonce(s) active(s) suffisamment proche(s)");
    expect(report).toContain("Ricardo : 0 vente(s) conclue(s), 1 annonce(s) active(s)");
    expect(report).toContain("✅ Vente conclue — eBay");
    expect(report).toContain("🟦 Annonce active — Ricardo 🇨🇭");
  });

  it("bloque le verdict achat lorsqu'il n'existe aucune vente conclue", () => {
    const report = formatFullDealAnalysis(
      product,
      { ...score, recommendation: "BUY", total_score: 91, scoring_version: "v5" },
      Array.from({ length: 5 }, (_, index) => ({
        source: "ebay_active_listing",
        evidence_type: "ACTIVE_LISTING",
        title: `Seiko active ${index}`,
        price: 70 + index,
        currency: "CHF",
        match_score: 0.8
      }))
    );

    expect(report).toContain("À CONFIRMER — PAS D’ACHAT AUTOMATIQUE");
    expect(report).toContain("Score technique historique : 91/100");
    expect(report).toContain("Score calculé par v5");
    expect(report).toContain("ne pas utiliser comme ordre d’achat");
  });

  it("écarte les comparables de montre sous 70 pour cent", () => {
    const report = formatFullDealAnalysis(product, score, [
      {
        source: "ebay_active_listing",
        title: "Seiko 7S26 unrelated",
        price: 70,
        currency: "CHF",
        match_score: 0.5
      }
    ]);
    expect(report).toContain("1 comparable(s) trop éloigné(s) exclu(s)");
    expect(report).toContain("Aucun comparable suffisamment proche");
  });

  it("signale que l'authenticité et le risque Frankenstein restent non confirmés", () => {
    const report = formatFullDealAnalysis(product, score, []);
    expect(report).toContain("AUTHENTICITÉ / FRANKENSTEIN : DOUTE / NON CONFIRMÉ");
    expect(report).toContain("ne peut pas exclure une Frankenstein");
    expect(report).toContain("il ne remplace pas une expertise physique");
  });

  it("détecte les termes critiques de cadran aftermarket ou redial", () => {
    const report = formatFullDealAnalysis(
      { ...product, description: "custom aftermarket redial, no returns" },
      score,
      []
    );
    expect(report).toContain("AUTHENTICITÉ / FRANKENSTEIN : RISQUE ÉLEVÉ");
    expect(report).toContain("aftermarket");
    expect(report).toContain("redial");
  });

  it("explique un calibre Seiko sans référence complète de boîte", () => {
    const report = formatFullDealAnalysis(
      { ...product, title: "Vintage Seiko 5 Purple Dial Automatic Movement No. 7009A" },
      score,
      []
    );
    expect(report).toContain("Référence/calibre détecté : 7009a");
    expect(report).toContain("référence complète de boîte");
  });
});
