type Row = Record<string, any>;

const money = (value: unknown) => {
  const number = typeof value === "number" ? value : Number(value ?? 0);
  return `${Number.isFinite(number) ? number.toFixed(0) : "0"} CHF`;
};

const percent = (value: unknown) => {
  const number = typeof value === "number" ? value : Number(value ?? 0);
  return `${Number.isFinite(number) ? number.toFixed(1) : "0.0"} %`;
};

const list = (values: unknown, fallback: string) => {
  const items = Array.isArray(values) ? values.filter(Boolean).slice(0, 6) : [];
  return items.length ? items.map((item) => `• ${item}`).join("\n") : `• ${fallback}`;
};

const scoreLine = (label: string, value: unknown, explanation: string) => {
  const number = typeof value === "number" ? value : Number(value ?? 0);
  const shown = Number.isFinite(number) ? Math.round(number) : 0;
  return `• ${label} : ${shown}/100 — ${explanation}`;
};

const conditionExplanation = (value: unknown) => {
  const number = typeof value === "number" ? value : Number(value ?? 0);
  if (number >= 90) return "neuf ou quasi neuf";
  if (number >= 80) return "excellent état";
  if (number >= 65) return "bon état revendable";
  if (number >= 45) return "état usagé, prudence sur la revente";
  return "réparation ou état incertain";
};

export function formatFullDealAnalysis(product: Row, score: Row, comparables: Row[] = []) {
  const comparableLines = comparables.length
    ? comparables.slice(0, 5).map((item) => {
        const title = item.title ? ` — ${String(item.title).slice(0, 70)}` : "";
        return `• ${item.source ?? "source"} : ${money(item.price)}${title}`;
      }).join("\n")
    : "• Aucun comparable détaillé enregistré pour ce score.";

  return `🧾 Analyse complète Deal Hunter

Produit
• ${product.title ?? "Titre indisponible"}
• Marque : ${product.brand ?? "Non précisée"}
• Modèle : ${product.model ?? "Non précisé"}
• Source : ${product.source ?? "inconnue"}
• État : ${product.condition_text ?? product.condition_grade ?? "Non précisé"}
• Lien : ${product.product_url ?? "indisponible"}

Décision
• Signal : ${score.recommendation ?? "REVIEW"}
• Décision : ${score.decision_status ?? "REVIEW_REQUIRED"}
• Preuve : ${score.evidence_grade ?? "D"}
• Raison : ${score.decision_rationale ?? "Analyse humaine complémentaire requise."}

Chiffres
• Prix annonce : ${money(product.price_amount)}
• Coût estimé livré : ${money(score.estimated_buy_cost)}
• Revente estimée : ${money(score.estimated_resale_price)}
• Bénéfice net : ${money(score.estimated_net_profit)}
• ROI : ${percent(score.estimated_roi_percent)}
• Offre maximum : ${money(score.maximum_offer)}
• Seuil sans perte : ${money(score.break_even_resale_price)}

Score
${scoreLine("Total", score.total_score, "synthèse marge + liquidité + risque + état")}
${scoreLine("Marge", score.margin_score, "qualité économique du deal")}
${scoreLine("Liquidité", score.liquidity_score, "facilité estimée de revente")}
${scoreLine("Risque", score.risk_score, "plus haut = moins risqué")}
${scoreLine("État", score.condition_score, conditionExplanation(score.condition_score))}
${scoreLine("Urgence", score.urgency_score, "pression temporelle de l’annonce")}
• Confiance marché : ${score.market_confidence ?? "LOW"} (${score.comparable_count ?? 0} comparables)

Plan d’action
${score.action_plan ?? "Vérifier l’état, les frais, l’authenticité et ne pas dépasser l’offre maximum."}

Pourquoi c’est retenu
${list(score.reasons, "Pas de raison détaillée enregistrée.")}

Points à vérifier
${list(score.warnings, "Aucun signal critique automatique, vérification humaine requise.")}

Comparables enregistrés
${comparableLines}`.slice(0, 3900);
}
