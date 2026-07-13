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

function isWatchProduct(product: Row) {
  return /montre|watch|horlog/i.test(`${product.category ?? ""} ${product.title ?? ""}`);
}

function watchReferenceTokens(value: unknown) {
  const text = normalized(value).replace(/[^a-z0-9-]+/g, " ");
  return [...new Set(
    text.match(/\b(?=[a-z0-9-]{4,12}\b)(?=[a-z0-9-]*\d{2})[a-z0-9]+(?:-[a-z0-9]+)?\b/g)
      ?.filter((token) => !/^\d{2,4}(?:mm|cm|m|h|jewels?)$/.test(token))
      .filter((token) => !/^(?:automatic|quartz|vintage|watch|wrist)$/.test(token))
      ?? []
  )];
}

function verdict(score: Row, soldCount: number) {
  if (soldCount === 0) {
    return {
      icon: "🟠",
      title: "À CONFIRMER — PAS D’ACHAT AUTOMATIQUE",
      text: "Aucune vente conclue suffisamment proche ne valide le prix de revente. Les annonces actives indiquent seulement des prix demandés."
    };
  }
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
  const references = watchReferenceTokens(`${product.title ?? ""} ${product.model ?? ""}`);
  const fullCaseReference = references.find((reference) => /^\d{4}-\d{4}$/.test(reference));
  const calibreOnly = references.find((reference) => !reference.includes("-"));
  const hasModel = Boolean(String(product.model ?? "").trim());
  const reasons: string[] = [];

  if (criticalTerms.length) {
    return {
      icon: "🔴",
      level: "RISQUE ÉLEVÉ",
      summary: "Des termes compatibles avec une pièce non d’origine, modifiée ou contrefaite sont présents.",
      reasons: [`Termes détectés : ${criticalTerms.join(", ")}.`, "Ne pas considérer la montre comme authentique sans contrôle spécialisé."]
    };
  }

  if (cautionTerms.length) reasons.push(`Termes à contrôler : ${cautionTerms.join(", ")}.`);
  if (references.length) reasons.push(`Référence/calibre détecté dans le texte : ${references.join(", ")} — à confirmer sur le fond et le mouvement.`);
  if (normalized(product.brand).includes("seiko") && calibreOnly && !fullCaseReference) {
    reasons.push(`Le calibre ${calibreOnly.toUpperCase()} est mentionné, mais la référence complète de boîte au format calibre-boîtier n’est pas confirmée.`);
  }
  if (!hasModel) reasons.push("Modèle exact non structuré dans l’annonce.");
  if (product.condition_grade === "UNKNOWN") reasons.push("État technique classé comme incertain.");
  reasons.push("La cohérence visuelle du cadran, des aiguilles, du fond et du mouvement n’est pas authentifiée automatiquement.");

  if (cautionTerms.length || !hasModel || !fullCaseReference || product.condition_grade === "UNKNOWN") {
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
    summary: "Aucun indice textuel évident de Frankenstein n’a été détecté, mais l’authenticité n’est pas certifiée.",
    reasons
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
  const minimumMatch = isWatchProduct(product) ? 0.7 : 0.6;
  const usableComparables = comparables.filter((item) => {
    const match = Number(item.match_score ?? item.matchScore);
    return Number.isFinite(match) ? match >= minimumMatch : !isWatchProduct(product);
  });
  const weakComparables = comparables.length - usableComparables.length;
  const sold = usableComparables.filter((item) => evidenceKind(item) === "SOLD");
  const active = usableComparables.filter((item) => evidenceKind(item) === "ACTIVE_LISTING");
  const signals = usableComparables.filter((item) => evidenceKind(item) === "MARKET_SIGNAL");
  const decision = verdict(score, sold.length);
  const auth = authenticityAssessment(product, score);
  const ricardoSold = sold.filter((item) => normalized(item.source).includes("ricardo"));
  const ricardoActive = active.filter((item) => normalized(item.source).includes("ricardo"));
  const shownEvidence = [...sold.slice(0, 2), ...active.slice(0, 2), ...signals.slice(0, 1)].slice(0, 4);
  const confidence = sold.length === 0 ? "LOW" : String(score.market_confidence ?? "LOW").toUpperCase();
  const confidenceText = confidence === "HIGH" ? "forte" : confidence === "MEDIUM" ? "moyenne" : "faible";
  const price = Number(product.price_amount ?? 0);
  const maxOffer = Number(score.maximum_offer ?? 0);
  const overOffer = Number.isFinite(price) && Number.isFinite(maxOffer) && price > maxOffer;
  const scoringVersion = String(score.scoring_version ?? "ancienne version");
  const legacyScore = scoringVersion !== "v6";
  const safeReasons = Array.isArray(score.reasons)
    ? score.reasons.filter((reason: unknown) => sold.length > 0 || !/soutenue par des comparables|preuve medium/i.test(String(reason)))
    : [];

  const report = `📊 ANALYSE PRO — DEAL HUNTER

${decision.icon} VERDICT : ${decision.title}
${decision.text}
⭐ ${sold.length === 0 ? "Score technique historique" : "Score"} : ${score.total_score ?? "—"}/100 • confiance ${confidenceText}
${legacyScore ? `⚠️ Score calculé par ${scoringVersion}; les garde-fous v6 s’appliqueront aux prochains scans.` : "🛡️ Garde-fous marché v6 appliqués."}

📦 LE PRODUIT
${compact(product.title || "Titre indisponible", 120)}
🌍 Source : ${sourceLabel(product.source)}
💵 Prix annoncé : ${money(product.price_amount)}
🏷️ Marque / modèle : ${product.brand ?? "non précisée"} • ${product.model ?? "non précisé"}
🛠️ État annoncé : ${product.condition_text ?? product.condition_grade ?? "non précisé"}
${watchReferenceTokens(`${product.title ?? ""} ${product.model ?? ""}`).length ? `🔢 Référence/calibre détecté : ${watchReferenceTokens(`${product.title ?? ""} ${product.model ?? ""}`).join(", ")}` : "🔢 Référence exacte : non détectée"}

💰 EST-CE RENTABLE ?
• Coût livré estimé : ${money(score.estimated_buy_cost)}
• Revente estimée : ${money(score.estimated_resale_price)}${sold.length === 0 ? " ⚠️ indicative, non validée par vente conclue" : ""}
• Bénéfice net estimé : ${money(score.estimated_net_profit)}${sold.length === 0 ? " ⚠️ théorique" : ""}
• ROI estimé : ${percent(score.estimated_roi_percent)}${sold.length === 0 ? " ⚠️ théorique" : ""}
• ${sold.length === 0 ? "Plafond provisoire calculé" : "Offre maximum conseillée"} : ${money(score.maximum_offer)}${sold.length === 0 ? " — ne pas utiliser comme ordre d’achat" : overOffer ? " ⚠️ prix actuel trop élevé" : " ✅ prix dans la limite"}
• Seuil sans perte : ${money(score.break_even_resale_price)}

📈 PREUVES DE MARCHÉ
• ${sold.length} vente(s) conclue(s) suffisamment proche(s)
• ${active.length} annonce(s) active(s) suffisamment proche(s)
• ${signals.length} autre(s) signal(aux) de marché
• Ricardo : ${ricardoSold.length} vente(s) conclue(s), ${ricardoActive.length} annonce(s) active(s)
• ${weakComparables} comparable(s) trop éloigné(s) exclu(s) du verdict (< ${Math.round(minimumMatch * 100)} %)
${sold.length === 0 ? "⛔ Aucune vente conclue fiable : les prix demandés ne permettent pas de valider une revente ni un achat." : "✅ L’estimation contient au moins une transaction conclue suffisamment proche."}

${shownEvidence.length ? shownEvidence.map(evidenceLine).join("\n\n") : "⚠️ Aucun comparable suffisamment proche n’est disponible. Ne pas acheter sur la seule base du score."}

${auth.icon} AUTHENTICITÉ / FRANKENSTEIN : ${auth.level}
${auth.summary}
${auth.reasons.map((reason) => `• ${reason}`).join("\n")}

🔍 À DEMANDER AU VENDEUR
• Référence exacte et photos nettes du cadran, fond, couronne et entre-cornes.
• Photo du mouvement et de ses marquages, idéalement par un horloger.
• Confirmation écrite des pièces remplacées : cadran, aiguilles, couronne, verre, bracelet et mouvement.
• Historique de service, facture et politique de retour si l’authenticité ne correspond pas.

🧭 PLAN SIMPLE
${sold.length === 0 ? "Ne pas acheter automatiquement. Chercher d’abord une vente conclue de la même référence et confirmer le calibre, la boîte et le mouvement." : score.action_plan ?? "Ne pas dépasser l’offre maximum. Vérifier l’authenticité, l’état et tous les frais avant paiement."}

⚠️ RISQUES SIGNALÉS
${listLines(score.warnings, "Aucun signal critique automatique, mais une vérification humaine reste obligatoire.")}

🧾 POURQUOI CE SCORE ?
${listLines(safeReasons, sold.length === 0 ? "Ancien score non validable faute de vente conclue suffisamment proche." : "Raisons détaillées indisponibles.", 4)}

🔗 ANNONCE
${product.product_url ?? "Lien indisponible"}

ℹ️ Deal Hunter analyse les données disponibles ; il ne remplace pas une expertise physique ni une authentification de marque.`;

  return report.slice(0, 3900);
}
