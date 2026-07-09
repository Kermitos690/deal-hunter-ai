import { describe,expect,it } from "vitest";
import { parseBrands,positiveNumber } from "@/telegram/radar-wizard";

describe("Telegram radar wizard",()=>{
  it("reconnaît plusieurs marques sans virgules",()=>{
    expect(parseBrands("Prada Louis Vuitton FENDI Gucci Hermes")).toEqual(["Prada","Louis Vuitton","Fendi","Gucci","Hermès"]);
    expect(parseBrands("Omega TAG Heuer Rolex Tissot")).toEqual(["Omega","TAG Heuer","Rolex","Tissot"]);
  });
  it("conserve une marque inconnue et accepte les montants suisses",()=>{
    expect(parseBrands("Marque artisanale")).toEqual(["Marque artisanale"]);
    expect(positiveNumber("1'500")).toBe(1500);
    expect(positiveNumber("-2")).toBeNull();
    expect(positiveNumber("abc")).toBeNull();
  });
});
