type Row = Record<string, any>;

type EvidenceKind = "SOLD" | "ACTIVE_LISTING" | "MARKET_SIGNAL";

const money = (value: unknown) => {
  const number = typeof value === "number" ? value : Number(value ?? 0);
  return `${Number.isFinite(number) ? Math.round(number) : 0} CHF`;
};

const percent = (value: unknown) => {
  const number = typeof value === "number" ? value : Number(value ?? 0);
  return `${Number.isFinite(number) ? number.toFixed(1) : "0.0"} %`;
};

const normalized = (value: unknown) => String(value ?? "")
  .normalize("NFD")
  .replace(/\p{Diacritic}/gu, "")
  .toLowerCase();

const compact = (value: unknown, max = 82) => {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

function sourceLabel(value: unknown) {
  const source = normalized(value);
  if (source.includes("ricardo")) return "Ricardo 🇨🇭";
  if (source.includes("ebay")) return "eBay";
  if (source.includes("komehyo")) return "KOMEHYO 🇯🇵";
  if (source.includes("anibis")) return "Anibis 🇨🇭";
  if (source.includes("tutti")) return "Tutti 🇨🇭";
  return compact(value || "Source inconnue", 30);
}

function evidenceKind(item: Row): EvidenceKind {
  const explicit = String(item.evidence_type ?? item.evidenceType ?? "").toUpperCase();
  if (explicit === "SOLD" || explicit === "ACTIVE_LISTING" || explicit === "MARKET_SIGNAL") return explicit;
  return String(item.source ?? "").endsWith("_active_listing") ? "ACTIVE_LISTING" : "SOLD";
}

function verdict(score: Row) {
  const recommendation = String(score.recommendation ?? "REVIEW").toUpperCase();
  if (recommendation === "BUY") return { icon: "🟢", title: "ACHAT POSSIBLE", text: "Le prix paraît intéressant, mais seulement après les vérifications ci-dessous." };
  if (recommendation === "NEGOTIATE") return { icon: "🟡", title: "NÉGOCIER", text: "Le deal peut devenir intéressant uniquement sous l’offre maximum calculée." };
  if (recommendation === "WATCH") return { icon: "🟠", title: "À SURVEILLER", text: "La marge ou les preuves sont encore trop faibles pour acheter sereinement." };
  return { icon: "🔴", title: "À ÉVITER", text: "Le rapport risque/rendement ne justifie pas l’achat dans l’état actuel." };
}

function authenticityAssessment(product: Row, score: Row) {
  const text = normalized(`${product.title ?? ""} ${product.description ?? ""} ${(score.warnings ?? []).join(" ")}`);
  const criticalTerms = [
    "franken", "frankenwatch", "replica", "replique", "fake", "counterfeit",
    "aftermarket", "custom dial", "redial", "re-dial", "repainted dial",
    "refinished dial", "replacement dial", "marriage watch", "assembled watch",
    "not original", "non original", "homage"
  ].filter((term) => text.includes(term));
  const cautionTerms = [
    "service dial", "modified", "modded", "replacement", "restored dial",
    "parts", "movement only", "case only", "untested", "non teste", "as is"
  ].filter((term) => text.includes(term));
  const hasReference = /\b(?:ref(?:erence)?\.?\s*)?[a-z0-9-]{4,12}\b/i.test(String(product.model ?? "")) || /\b\d{4,8}[a-z-]*\b/i.test(String(product.title ?? ""));
  const hasModel = Boolean(String(product.model ?? "").trim());
  const photoCount = Array.isArray(product.image_urls) ? product.image_urls.length : Number(product.raw_payload?.imageCount ?? 0);

  if (criticalTerms.length) {
    return {
      icon: "🔴",
      level: "RISQUE ÉLEVÉ",
      summary: "Des termes compatibles avec une pièce non d’origine, modifiée ou contrefaite sont présents.",
      reasons: [`Termes détectés : ${criticalTerms.join(", ")}.`, "Ne pas considérer la montre comme authentique sans contrôle spécialisé."]
    };
  }
  if (cautionTerms.length || !hasModel || !hasReference || product.condition_grade === "UNKNOWN") {
    const reasons = [];
    if (cautionTerms.length) reasons.push(`Termes à contrôler : ${cautionTerms.join(", ")}.`);
    if (!hasModel) reasons.push("Modèle exact non structuré dans l’annonce.");
    if (!hasReference) reasons.push("Référence exploitable non confirmée automatiquement.");
    if (product.condition_grade === "UNKNOWN") reasons.push("État technique classé comme incertain.");
    return {
      icon: "🟠",
      level: "DOUTE / NON CONFIRMÉ",
      summary: "Deal Hunter ne peut pas exclure une Frankenstein, un cadran refait ou des pièces remplacées avec les données disponibles.",
      reasons
    };
  }
  return {
    icon: "🟡",
    level: "AUCUN SIGNAL TEXTUEL MAJEUR",
    summary: "Aucun indice automatique évident de Frankenstein n’a été détecté, mais l’authenticité n’est pas certifiée sur cette base.",
    reasons: [photoCount > 0 ? `${photoCount} photo(s) signalée(s) dans les données de l’annonce.` : "Les photos doivent être contrôlées manuellement.", "Le mouvement, le cadran, le fond et les numéros doivent correspondre à la référence."]
  };
}

function evidenceLine(item: Row) {
  const kind = evidenceKind(item);
  const marker = kind === "SOLD" ? "✅ Vente conclue" : kind === "ACTIVE_LISTING" ? "🟦 Annonce active" : "🔎 Signal marché";
  const date = item.sold_at || item.soldAt ? ` • ${String(item.sold_at ?? item.soldAt).slice(0, 10)}` : "";
  const match = Number(item.match_score ?? item.matchScore);
  const similarity = Number.isFinite(match) ? ` • correspondance ${Math.round(match * 100)}%` : "";
  const link = item.evidence_url ?? item.evidenceUrl;
  return `${marker} — ${sourceLabel(item.source)} — ${money(item.price ?? item.sold_price)}${date}${similarity}\n${compact(item.title || "Comparable sans titre", 72)}${link ? `\n🔗 ${link}` : ""}`;
}

function listLines(values: unknown, fallback: string, max = 5) {
  const items = Array.isArray(values) ? values.filter(Boolean).slice(0, max) : [];
  return items.length ? items.map((item) => `• ${compact(item, 150)}`).join("\n") : `• ${fallback}`;
}

export function formatFullDealAnalysis(product: Row, score: Row, comparables: Row[] = []) {
  const decision = verdict(score);
  const auth = authenticityAssessment(product, score);
  const sold = comparables.filter((item) => evidenceKind(item) === "SOLD");
  const active = comparables.filter((item) => evidenceKind(item) === "ACTIVE_LISTING");
  const signals = comparables.filter((item) => evidenceKind(item) === "MARKET_SIGNAL");
  const ricardoSold = sold.filter((item) => normalized(item.source).includes("ricardo"));
  const ricardoActive = active.filter((item) => normalized(item.source).includes("ricardo"));
  const shownEvidence = [...sold.slice(0, 3), ...active.slice(0, 2), ...signals.slice(0, 1)].slice(0, 5);
  const confidence = String(score.market_confidence ?? "LOW").toUpperCase();
  const confidenceText = confidence === "HIGH" ? "forte" : confidence === "MEDIUM" ? "moyenne" : "faible";
  const price = Number(product.price_amount ?? 0);
  const maxOffer = Number(score.maximum_offer ?? 0);
  const overOffer = Number.isFinite(price) && Number.isFinite(maxOffer) && price > maxOffer;

  const report = `📊 ANALYSE PRO — DEAL HUNTER

${decision.icon} VERDICT : ${decision.title}
${decision.text}
⭐ Score : ${score.total_score ?? "—"}/100 • confiance ${confidenceText}

📦 LE PRODUIT
${compact(product.title || "Titre indisponible", 120)}
🌍 Source : ${sourceLabel(product.source)}
💵 Prix annoncé : ${money(product.price_amount)}
🏷️ Marque / modèle : ${product.brand ?? "non précisée"} • ${product.model ?? "non précisé"}
🛠️ État annoncé : ${product.condition_text ?? product.condition_grade ?? "non précisé"}

💰 EST-CE RENTABLE ?
• Coût livré estimé : ${money(score.estimated_buy_cost)}
• Revente prudente estimée : ${money(score.estimated_resale_price)}
• Bénéfice net estimé : ${money(score.estimated_net_profit)}
• ROI estimé : ${percent(score.estimated_roi_percent)}
• Offre maximum conseillée : ${money(score.maximum_offer)}${overOffer ? " ⚠️ prix actuel trop élevé" : " ✅ prix dans la limite"}
• Seuil sans perte : ${money(score.break_even_resale_price)}

📈 PREUVES DE MARCHÉ
• ${sold.length} vente(s) conclue(s) vérifiée(s) dans ce score
• ${active.length} annonce(s) active(s) utilisée(s) comme indication
• ${signals.length} autre(s) signal(aux) de marché
• Ricardo : ${ricardoSold.length} vente(s) conclue(s), ${ricardoActive.length} annonce(s) active(s)
${sold.length === 0 ? "⚠️ Aucune vente conclue n’est disponible : l’estimation repose surtout sur des prix demandés, pas sur des prix réellement payés." : "✅ L’estimation contient au moins une transaction conclue."}

${shownEvidence.length ? shownEvidence.map(evidenceLine).join("\n\n") : "⚠️ Aucun comparable détaillé enregistré. Ne pas acheter sur la seule base du score."}

${auth.icon} AUTHENTICITÉ / FRANKENSTEIN : ${auth.level}
${auth.summary}
${auth.reasons.map((reason) => `• ${reason}`).join("\n")}

🔍 À DEMANDER AU VENDEUR
• Référence exacte et photos nettes du cadran, fond, couronne et entre-cornes.
• Photo du mouvement et de ses marquages, idéalement par un horloger.
• Confirmation écrite des pièces remplacées : cadran, aiguilles, couronne, verre, bracelet et mouvement.
• Historique de service, facture et politique de retour si l’authenticité ne correspond pas.

🧭 PLAN SIMPLE
${score.action_plan ?? "Ne pas dépasser l’offre maximum. Vérifier l’authenticité, l’état et tous les frais avant paiement."}

⚠️ RISQUES SIGNALÉS
${listLines(score.warnings, "Aucun signal critique automatique, mais une vérification humaine reste obligatoire.")}

🧾 POURQUOI CE SCORE ?
${listLines(score.reasons, "Raisons détaillées indisponibles.", 4)}

🔗 ANNONCE
${product.product_url ?? "Lien indisponible"}

ℹ️ Deal Hunter analyse les données disponibles ; il ne remplace pas une expertise physique ni une authentification de marque.`;

  return report.slice(0, 3900);
}
