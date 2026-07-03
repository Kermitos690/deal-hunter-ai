import { describe, expect, it } from "vitest";
import { radarSchema } from "@/lib/validation/radar";
import { enforcePlanLimits } from "@/plans/limits";
describe("radars et plans", () => {
  it("refuse un budget négatif", () => expect(radarSchema.safeParse({name:"x",category:"x",max_buy_price:-1}).success).toBe(false));
  it("limite Free à deux radars", () => expect(enforcePlanLimits({plan:"free"},{activeRadars:2,alertsToday:0}).allowed).toBe(false));
});
