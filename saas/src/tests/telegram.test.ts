import { describe, expect, it } from "vitest";
import { parseAuctionResponse } from "@/telegram/auction-response";
import { formatTelegramAlert } from "@/telegram/format-alert";
import { mockCandidates } from "@/sources/mock.adapter";
describe("Telegram", () => {
  it("comprend A/B", () => {
    expect(parseAuctionResponse("A")).toBe("REMIND");
    expect(parseAuctionResponse("b")).toBe("IGNORE");
    expect(parseAuctionResponse("x")).toBeNull();
  });
  it("mentionne le risque d’authenticité", () => {
    const text=formatTelegramAlert(mockCandidates[0],{totalScore:80,marginScore:80,liquidityScore:70,riskScore:70,conditionScore:70,urgencyScore:50,estimatedBuyCost:150,estimatedResalePrice:290,estimatedNetProfit:90,estimatedRoiPercent:60,recommendation:"NEGOTIATE",reasons:["Marge"],warnings:[]});
    expect(text).toContain("Authenticité à vérifier");
  });
});
