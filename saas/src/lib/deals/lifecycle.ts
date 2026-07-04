import { z } from "zod";

export const dealLifecycleSchema = z.object({
  status: z.enum(["saved", "purchased", "listed", "sold", "abandoned"]),
  actualBuyPrice: z.number().positive().optional(),
  actualSalePrice: z.number().positive().optional(),
  actualFees: z.number().min(0).optional(),
  notes: z.string().trim().max(2000).optional()
}).superRefine((value, context) => {
  if (["purchased", "listed", "sold"].includes(value.status) && !value.actualBuyPrice) {
    context.addIssue({
      code: "custom",
      path: ["actualBuyPrice"],
      message: "Le prix d’achat réel est requis."
    });
  }
  if (value.status === "sold" && !value.actualSalePrice) {
    context.addIssue({
      code: "custom",
      path: ["actualSalePrice"],
      message: "Le prix de revente réel est requis."
    });
  }
});

export type DealLifecycleInput = z.infer<typeof dealLifecycleSchema>;

export function actualProfit(input: DealLifecycleInput) {
  if (input.status !== "sold" || !input.actualBuyPrice || !input.actualSalePrice) return null;
  return Number((input.actualSalePrice - input.actualBuyPrice - (input.actualFees ?? 0)).toFixed(2));
}

export function estimateAccuracy(estimatedProfit: number, realizedProfit: number) {
  const absoluteError = Math.abs(realizedProfit - estimatedProfit);
  const errorPercent =
    Math.abs(estimatedProfit) > 0 ? (absoluteError / Math.abs(estimatedProfit)) * 100 : null;
  return {
    difference: Number((realizedProfit - estimatedProfit).toFixed(2)),
    absoluteError: Number(absoluteError.toFixed(2)),
    errorPercent: errorPercent === null ? null : Number(errorPercent.toFixed(1))
  };
}
