import type { DealScore, ProductCandidate } from "@/types";

const money = (value: number) => `${value.toFixed(0)} CHF`;

export function formatTelegramAlert(candidate: ProductCandidate, score: DealScore) {
  const reasons = score.reasons.slice(0, 3).map((reason) => `• ${reason}`).join("\n");
  const warnings = score.warnings.length
    ? score.warnings.slice(0, 3).map((warning) => `• ${warning}`).join("\n")
    : "• Aucun signal critique automatique. Vérification humaine requise.";
  return `🚨 DEAL HUNTER AI — OPPORTUNITÉ DÉTECTÉE

👜 Produit : ${candidate.title}
🏷️ Marque : ${candidate.brand ?? "Non précisée"}
🌍 Source : ${candidate.source}
💰 Prix : ${money(candidate.priceAmount)}
🚚 Coût estimé livré : ${money(score.estimatedBuyCost)}
📈 Revente estimée : ${money(score.estimatedResalePrice)}
🟢 Bénéfice net estimé : ${money(score.estimatedNetProfit)}
📊 ROI estimé : ${score.estimatedRoiPercent.toFixed(1)} %
⭐ Score : ${score.totalScore}/100

🧠 Verdict : ${score.recommendation}

✅ Pourquoi c’est intéressant :
${reasons}

⚠️ Points à vérifier :
${warnings}

Authenticité à vérifier : Deal Hunter AI ne garantit jamais l’authenticité.`;
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
