import type { DealScore, ProductCandidate } from "@/types";
import { decisionLabel } from "@/scoring/decision-framework";

const money = (value: number) => `${value.toFixed(0)} CHF`;

const recommendationLabel: Record<string, string> = {
  BUY: "ACHAT PRIORITAIRE",
  NEGOTIATE: "À NÉGOCIER",
  WATCH: "À SURVEILLER",
  AVOID: "À ÉCARTER"
};

export function formatTelegramAlert(candidate: ProductCandidate, score: DealScore) {
  const reasons = score.reasons.slice(0, 3).map((reason) => `• ${reason}`).join("\n");
  const warnings = score.warnings.length
    ? score.warnings.slice(0, 3).map((warning) => `• ${warning}`).join("\n")
    : "• Aucun signal critique automatique. Vérification humaine requise.";
  const status = score.decisionStatus ?? "REVIEW_REQUIRED";
  const signal = recommendationLabel[score.recommendation] ?? score.recommendation;
  return `DEAL HUNTER AI — NOTE D’OPPORTUNITÉ

DÉCISION : ${decisionLabel[status]}
NIVEAU DE PREUVE : ${score.evidenceGrade ?? "D"}
${score.decisionRationale ?? "Analyse humaine complémentaire requise."}

👜 Produit : ${candidate.title}
🏷️ Marque : ${candidate.brand ?? "Non précisée"}
🌍 Source : ${candidate.source}
💰 Prix : ${money(candidate.priceAmount)}
🚚 Coût estimé livré : ${money(score.estimatedBuyCost)}
📈 Revente estimée : ${money(score.estimatedResalePrice)}
🟢 Bénéfice net estimé : ${money(score.estimatedNetProfit)}
📊 ROI estimé : ${score.estimatedRoiPercent.toFixed(1)} %
⭐ Score : ${score.totalScore}/100
🔎 Confiance marché : ${score.marketConfidence} (${score.comparableCount} comparables)
🧮 Moteur d’analyse : ${score.scoringVersion}

🧠 Signal : ${signal}
🎯 Offre maximum : ${money(score.maximumOffer ?? score.estimatedBuyCost)}
🛡 Seuil sans perte : ${money(score.breakEvenResalePrice ?? score.estimatedResalePrice)}
🏪 Revente conseillée : ${score.recommendedChannel ?? "eBay"}
⏳ Délai indicatif : ${score.estimatedSaleDays ? `${score.estimatedSaleDays} jours` : "à confirmer"}

📋 Plan d’action :
${score.actionPlan ?? "Vérifier les risques et ne pas dépasser l’offre maximum."}

✅ Pourquoi c’est intéressant :
${reasons}

⚠️ Points à vérifier :
${warnings}

AVERTISSEMENT : estimation indicative, non garantie. Authenticité à vérifier, ainsi que l’état, les frais et les conditions de retour avant tout engagement.`;
}

export function auctionReminderText(
  candidate: ProductCandidate,
  score: DealScore,
  maximumBid: number
) {
  return `⏰ RAPPEL ENCHÈRE — 1H AVANT LA FIN

Produit : ${candidate.title}
Prix actuel : ${candidate.priceAmount} ${candidate.priceCurrency}
Score : ${score.totalScore}/100
Lien : ${candidate.productUrl}

Décision recommandée :
• Prix maximum conseillé : ${maximumBid.toFixed(0)} CHF
• Ne pas dépasser : ${maximumBid.toFixed(0)} CHF
• Raison : conserver la marge nette et les frais de sécurité.`;
}
