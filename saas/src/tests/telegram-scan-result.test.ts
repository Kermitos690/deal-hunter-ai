import { describe, expect, it } from "vitest";
import { scanResultText } from "@/telegram/bot";
import { parseSearchIntent, searchSuggestionsFor } from "@/telegram/radar-wizard";

describe("scanResultText", () => {
  it("résume les annonces analysées et alertes Telegram envoyées", () => {
    const text = scanResultText({ candidatesFound: 816, alertsCreated: 9, alertsSent: 9 });
    expect(text).toContain("816 annonce(s)");
    expect(text).toContain("9 opportunité(s) créée(s)");
    expect(text).toContain("9 alerte(s) Telegram envoyée(s)");
  });

  it("explique les opportunités créées mais non envoyées", () => {
    const text = scanResultText({
      candidatesFound: 12,
      alertsCreated: 2,
      alertsSent: 0,
      telegramSkipped: 2
    });
    expect(text).toContain("2 opportunité(s) créée(s)");
    expect(text).toContain("0 alerte(s) Telegram envoyée(s)");
    expect(text).toContain("2 alerte(s) non envoyée(s)");
    expect(text).toContain("Telegram n’a pas pu les envoyer");
  });

  it("explique un verrou concurrent", () => {
    expect(scanResultText({
      candidatesFound: 0, alertsSent: 0, skipped: true, reason: "radar_locked"
    })).toContain("déjà en cours");
  });
});

describe("parseSearchIntent", () => {
  it("corrige les fautes dans le contexte montres", () => {
    const intent = parseSearchIntent("Olex Omega longines", "Montres");
    expect(intent.brands).toEqual(expect.arrayContaining(["Rolex", "Omega", "Longines"]));
  });

  it("garde des propositions spécifiques pour les sneakers", () => {
    const suggestions = searchSuggestionsFor("Sneakers");
    expect(suggestions).toContain("Nike SB Dunk");
    expect(suggestions).not.toContain("TAG Heuer Professional");

    const intent = parseSearchIntent("Nike SB Dunk", "Sneakers");
    expect(intent.brands).toContain("Nike");
    expect(intent.models).toEqual(expect.arrayContaining(["Dunk", "SB Dunk"]));
  });
});
