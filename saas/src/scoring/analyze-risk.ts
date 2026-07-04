import type { MarketEstimate, ProductCandidate } from "@/types";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RiskAnalysis {
  score: number;
  level: RiskLevel;
  signals: string[];
  checks: string[];
}

const suspiciousTerms = [
  "replica", "réplique", "fake", "inspired", "style", "no return",
  "aucun retour", "as is", "untested", "non testé"
];

export function analyzeRisk(candidate: ProductCandidate, market: MarketEstimate): RiskAnalysis {
  let penalty = 0;
  const signals: string[] = [];
  const checks = new Set<string>();
  const text = `${candidate.title} ${candidate.description ?? ""}`.toLocaleLowerCase("fr");

  const suspicious = suspiciousTerms.filter((term) => text.includes(term));
  if (suspicious.length) {
    penalty += Math.min(45, suspicious.length * 20);
    signals.push(`Termes sensibles détectés : ${suspicious.join(", ")}.`);
    checks.add("Demander une preuve d’authenticité et une facture d’origine.");
  }
  if (!candidate.imageUrls.length) {
    penalty += 30;
    signals.push("Aucune photo exploitable.");
    checks.add("Obtenir des photos nettes des marquages, numéros et défauts.");
  } else if (candidate.imageUrls.length < 3) {
    penalty += 10;
    signals.push("Couverture photo limitée.");
    checks.add("Demander des photos supplémentaires avant paiement.");
  }
  if (!candidate.sellerRating) {
    penalty += 12;
    signals.push("Réputation du vendeur inconnue.");
    checks.add("Contrôler l’ancienneté, les évaluations et les ventes du vendeur.");
  }
  if (!candidate.brand) {
    penalty += 8;
    signals.push("Marque non structurée dans l’annonce.");
  }
  if (market.confidence === "LOW") {
    penalty += 18;
    signals.push("Valeur de marché faiblement documentée.");
    checks.add("Chercher manuellement des ventes conclues de même référence.");
  }
  if (market.low > 0 && candidate.priceAmount < market.low * 0.35) {
    penalty += 35;
    signals.push("Prix très inférieur au marché observé.");
    checks.add("Ne pas payer hors plateforme et vérifier la protection acheteur.");
  }
  if (candidate.conditionGrade === "REPAIR" || candidate.conditionGrade === "UNKNOWN") {
    penalty += 12;
    signals.push("État technique incertain ou réparation nécessaire.");
    checks.add("Obtenir un devis de remise en état avant l’achat.");
  }

  const score = Math.max(0, Math.min(100, 100 - penalty));
  const level: RiskLevel =
    score < 30 ? "CRITICAL" : score < 55 ? "HIGH" : score < 75 ? "MEDIUM" : "LOW";
  if (!signals.length) signals.push("Aucun signal automatique majeur détecté.");
  checks.add("Vérifier l’authenticité, les retours et le coût livré avant achat.");
  return { score, level, signals, checks: [...checks] };
}
