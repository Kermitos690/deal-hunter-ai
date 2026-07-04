export interface ResaleScenarioInput {
  itemPrice: number;
  shippingCost: number;
  customsCost: number;
  repairCost: number;
  vatRate: number;
  platformFeeRate: number;
  paymentFeeRate: number;
  marketLow: number;
  marketMedian: number;
  marketHigh: number;
  targetProfit?: number;
}

export interface ResaleScenario {
  key: "QUICK" | "MARKET" | "OPTIMIZED";
  label: string;
  resalePrice: number;
  saleFees: number;
  netProfit: number;
  roiPercent: number;
}

const money = (value: number) => Number(value.toFixed(2));

export function calculateResaleScenarios(input: ResaleScenarioInput) {
  const landedSubtotal =
    input.itemPrice + input.shippingCost + input.customsCost + input.repairCost;
  const vat = landedSubtotal * input.vatRate;
  const totalBuyCost = landedSubtotal + vat;
  const totalSaleFeeRate = input.platformFeeRate + input.paymentFeeRate;

  const build = (
    key: ResaleScenario["key"],
    label: string,
    resalePrice: number
  ): ResaleScenario => {
    const saleFees = resalePrice * totalSaleFeeRate;
    const netProfit = resalePrice - saleFees - totalBuyCost;
    return {
      key,
      label,
      resalePrice: money(resalePrice),
      saleFees: money(saleFees),
      netProfit: money(netProfit),
      roiPercent: money(totalBuyCost > 0 ? (netProfit / totalBuyCost) * 100 : 0)
    };
  };

  const targetProfit = Math.max(0, input.targetProfit ?? 0);
  const netResaleFactor = 1 - totalSaleFeeRate;
  const breakEvenResalePrice =
    netResaleFactor > 0 ? totalBuyCost / netResaleFactor : Number.POSITIVE_INFINITY;
  const maxItemPrice =
    netResaleFactor > 0
      ? ((input.marketMedian * netResaleFactor - targetProfit) / (1 + input.vatRate)) -
        input.shippingCost -
        input.customsCost -
        input.repairCost
      : 0;

  return {
    costs: {
      itemPrice: money(input.itemPrice),
      shippingCost: money(input.shippingCost),
      customsCost: money(input.customsCost),
      repairCost: money(input.repairCost),
      vat: money(vat),
      totalBuyCost: money(totalBuyCost)
    },
    totalSaleFeeRate: money(totalSaleFeeRate * 100),
    breakEvenResalePrice: money(breakEvenResalePrice),
    maxItemPriceForTargetProfit: money(Math.max(0, maxItemPrice)),
    scenarios: [
      build("QUICK", "Vente rapide", input.marketLow),
      build("MARKET", "Marché probable", input.marketMedian),
      build("OPTIMIZED", "Prix optimisé", input.marketHigh)
    ]
  };
}
