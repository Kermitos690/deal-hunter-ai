type Row = Record<string, any>;

export type AnalysisSection = "summary" | "market" | "auth" | "action";
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

const compact = (value: unknown, max = 90) => {
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
  return compact(value || "Source inconnue", 28);
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

function usableEvidence(product: Row, comparables: Row[]) {
  const minimumMatch = isWatchProduct(product) ? 0.7 : 0.6;
  const usable = comparables.filter((item) => {
    const match = Number(item.match_score ?? item.matchScore);
    return Number.isFinite(match) ? match >= minimumMatch : !isWatchProduct(product);
  });
  return {
    minimumMatch,
    usable,
    weak: comparables.length - usable.length,
    sold: usable.filter((item) => evidenceKind(item) === "SOLD"),
    active: usable.filter((item) => evidenceKind(item) === "ACTIVE_LISTING"),
    signals: usable.filter((item) => evidenceKind(item) === "MARKET_SIGNAL")
  };
}

function verdict(score: Row, soldCount: number) {
  if (soldCount === 0) {
    return {
      icon: "🟠",
      title: "À CONFIRMER",
      text: "Pas d’achat automatique sans vente conclue suffisamment proche."
    };
  }
  const recommendation = String(score.recommendation ?? "REVIEW").toUpperCase();
  if (recommendation === "BUY") return { icon: "🟢", title: "ACHAT POSSIBLE", text: "Intéressant uniquement après les contrôles indiqués." };
  if (recommendation === "NEGOTIATE") return { icon: "🟡", title: "NÉGOCIER", text: "Intéressant seulement sous le prix plafond." };
  if (recommendation === "WATCH") return { icon: "🟠", title: "À SURVEILLER", text: "Preuves ou marge encore insuffisantes." };
  return { icon: "🔴", title: "À ÉVITER", text: "Le risque/rendement ne justifie pas l’achat." };
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
  const reasons: string[] = [];

  if (criticalTerms.length) {
    return {
      icon: "🔴",
      level: "RISQUE ÉLEVÉ",
      summary: "L’annonce contient des termes compatibles avec une pièce modifiée ou non originale.",
      reasons: [`Termes détectés : ${criticalTerms.join(", ")}.`, "Authentification spécialisée indispensable."]
    };
  }

  if (cautionTerms.length) reasons.push(`Termes à contrôler : ${cautionTerms.join(", ")}.`);
  if (references.length) reasons.push(`Référence/calibre détecté : ${references.join(", ")} — à confirmer sur le fond et le mouvement.`);
  if (!fullCaseReference && isWatchProduct(product)) reasons.push("Référence complète calibre-boîtier non confirmée.");
  if (!String(product.model ?? "").trim()) reasons.push("Modèle exact non structuré dans l’annonce.");
  if (product.condition_grade === "UNKNOWN") reasons.push("État technique incertain.");
  reasons.push("Cadran, aiguilles, fond et mouvement non authentifiés automatiquement.");

  return {
    icon: reasons.length > 1 ? "🟠" : "🟡",
    level: reasons.length > 1 ? "DOUTE / NON CONFIRMÉ" : "AUCUN SIGNAL TEXTUEL MAJEUR",
    summary: "Deal Hunter ne certifie pas l’authenticité sur les seules données de l’annonce.",
    reasons
  };
}

function evidenceLine(item: Row) {
  const kind = evidenceKind(item);
  const marker = kind === "SOLD" ? "✅ Vente" : kind === "ACTIVE_LISTING" ? "🟦 Annonce" : "🔎 Signal";
  const match = Number(item.match_score ?? item.matchScore);
  const similarity = Number.isFinite(match) ? ` • ${Math.round(match * 100)}%` : "";
  const date = item.sold_at || item.soldAt ? ` • ${String(item.sold_at ?? item.soldAt).slice(0, 10)}` : "";
  const link = String(item.evidence_url ?? item.evidenceUrl ?? "").trim();
  return `${marker} ${sourceLabel(item.source)} • ${money(item.price ?? item.sold_price)}${similarity}${date}\n${compact(item.title || "Comparable sans titre", 82)}${link ? `\n🔗 ${link}` : ""}`;
}

function listLines(values: unknown, fallback: string, max = 4) {
  const items = Array.isArray(values) ? values.filter(Boolean).slice(0, max) : [];
  return items.length ? items.map((item) => `• ${compact(item, 145)}`).join("\n") : `• ${fallback}`;
}

export function formatDealAnalysisSection(
  product: Row,
  score: Row,
  comparables: Row[] = [],
  section: AnalysisSection = "summary"
) {
  const evidence = usableEvidence(product, comparables);
  const decision = verdict(score, evidence.sold.length);
  const auth = authenticityAssessment(product, score);
  const confidence = evidence.sold.length === 0 ? "faible" : String(score.market_confidence ?? "LOW").toLowerCase();
  const scoringVersion = String(score.scoring_version ?? "ancienne version");
  const legacy = scoringVersion !== "v6";
  const ricardoSold = evidence.sold.filter((item) => normalized(item.source).includes("ricardo")).length;
  const ricardoActive = evidence.active.filter((item) => normalized(item.source).includes("ricardo")).length;

  if (section === "market") {
    const shown = [...evidence.sold.slice(0, 3), ...evidence.active.slice(0, 3), ...evidence.signals.slice(0, 1)].slice(0, 5);
    return `📈 PREUVES DE MARCHÉ

✅ Ventes conclues proches : ${evidence.sold.length}
🟦 Annonces actives proches : ${evidence.active.length}
🇨🇭 Ricardo : ${ricardoSold} vente(s), ${ricardoActive} annonce(s)
🗑 Comparables trop éloignés exclus : ${evidence.weak}
🎯 Similarité minimale : ${Math.round(evidence.minimumMatch * 100)}%

${evidence.sold.length === 0 ? "⛔ Aucun prix réellement payé ne valide encore la revente." : "✅ Au moins une transaction conclue soutient l’estimation."}

${shown.length ? shown.map(evidenceLine).join("\n\n") : "Aucun comparable suffisamment proche."}`.slice(0, 3600);
  }

  if (section === "auth") {
    return `${auth.icon} AUTHENTICITÉ / FRANKENSTEIN

Niveau : ${auth.level}
${auth.summary}

${auth.reasons.map((reason) => `• ${reason}`).join("\n")}

🔍 À DEMANDER AU VENDEUR
• Référence exacte et photos nettes du cadran, fond, couronne et entre-cornes.
• Photo du mouvement et de ses marquages.
• Liste écrite des pièces remplacées : cadran, aiguilles, couronne, verre, bracelet, mouvement.
• Historique de service, facture et retour possible si la description est inexacte.

ℹ️ Une photo ou un texte ne remplace pas une expertise physique.`.slice(0, 2800);
  }

  if (section === "action") {
    const noSold = evidence.sold.length === 0;
    return `🧭 DÉCISION ET ACTION

${decision.icon} ${decision.title}
${decision.text}

💵 Prix annoncé : ${money(product.price_amount)}
🧾 Coût livré estimé : ${money(score.estimated_buy_cost)}
💰 Revente estimée : ${money(score.estimated_resale_price)}${noSold ? " ⚠️ non validée" : ""}
📊 Bénéfice / ROI : ${money(score.estimated_net_profit)} • ${percent(score.estimated_roi_percent)}
🚧 ${noSold ? "Plafond provisoire" : "Offre maximum"} : ${money(score.maximum_offer)}

${noSold ? "⛔ Ne pas acheter automatiquement. Chercher une vente conclue de la même référence et confirmer la cohérence calibre/boîte/mouvement." : score.action_plan ?? "Ne pas dépasser l’offre maximum et vérifier tous les frais."}

⚠️ RISQUES PRIORITAIRES
${listLines(score.warnings, "Aucun signal critique automatique, contrôle humain obligatoire.", 3)}`.slice(0, 2600);
  }

  return `📊 ANALYSE PRO

${decision.icon} VERDICT : ${decision.title}
${decision.text}
⭐ Score : ${score.total_score ?? "—"}/100 • confiance ${confidence}
${legacy ? `⚠️ Ancien calcul ${scoringVersion}; garde-fous v6 aux prochains scans.` : "🛡 Garde-fous v6 appliqués."}

📦 ${compact(product.title || "Titre indisponible", 105)}
🌍 ${sourceLabel(product.source)} • 💵 ${money(product.price_amount)}

💰 RENTABILITÉ
• Coût livré : ${money(score.estimated_buy_cost)}
• Revente : ${money(score.estimated_resale_price)}${evidence.sold.length === 0 ? " ⚠️ indicative" : ""}
• Net / ROI : ${money(score.estimated_net_profit)} • ${percent(score.estimated_roi_percent)}
• Prix plafond : ${money(score.maximum_offer)}${evidence.sold.length === 0 ? " ⚠️ provisoire" : ""}

📈 Marché : ${evidence.sold.length} vente(s) • ${evidence.active.length} annonce(s) • ${evidence.weak} exclue(s)
${auth.icon} Authenticité : ${auth.level}

👉 Utilise les boutons pour voir les preuves, les risques ou l’action conseillée.`.slice(0, 1000);
}

export function formatFullDealAnalysis(product: Row, score: Row, comparables: Row[] = []) {
  return formatDealAnalysisSection(product, score, comparables, "summary");
}
