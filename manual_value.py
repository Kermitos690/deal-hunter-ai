import os
import re
import time

import main as engine
import market_evidence

ALIASES = {
    "Pokémon Evolving Skies EN Booster Box": [
        "evolving skies",
        "evo skies",
    ],
    "Pokémon 151 JP Booster Box": [
        "pokemon 151",
        "151 jp",
        "151 japanese",
        "sv2a",
        "scarlet violet 151",
    ],
    "Pokémon Eevee Heroes JP Booster Box": [
        "eevee heroes",
        "s6a",
    ],
    "Pokémon VSTAR Universe JP Booster Box": [
        "vstar universe",
        "s12a",
    ],
    "Pokémon VMAX Climax JP Booster Box": [
        "vmax climax",
        "s8b",
    ],
    "Pokémon Terastal Festival JP Booster Box": [
        "terastal festival",
        "terastal",
        "sv8a",
    ],
    "Pokémon Blue Sky Stream JP Booster Box": [
        "blue sky stream",
        "s7r",
    ],
    "Pokémon Dream League JP Booster Box": [
        "dream league",
        "sm11b",
    ],
    "Topps Chrome UEFA Hobby Box": [
        "topps chrome uefa",
        "topps chrome ucl",
        "topps chrome champions",
        "uefa hobby",
        "ucl hobby",
    ],
    "One Piece Carrying On His Will Booster Box": [
        "carrying on his will",
        "op13",
        "op-13",
        "op 13",
        "one piece op13",
    ],
    "Lorcana Wilds Unknown Booster Box": [
        "wilds unknown",
        "lorcana wilds",
    ],
}


GENERIC_WORDS = {
    "pokemon",
    "pokémon",
    "booster",
    "box",
    "display",
    "sealed",
    "japanese",
    "japan",
    "jp",
    "jpn",
    "en",
    "english",
    "tcg",
    "trading",
    "card",
    "cards",
    "hobby",
}


def env_text(name, default=""):
    value = os.getenv(name)
    if value is None:
        return default
    return str(value).strip()


def parse_manual_price(raw):
    raw = str(raw or "").strip()

    if not raw:
        return None

    price_chf, _ = engine.parse_price_to_chf(raw, default_currency="CHF")

    if price_chf is not None:
        return price_chf

    match = re.search(r"([0-9][0-9'’., ]*)", raw)

    if not match:
        return None

    try:
        return engine.clean_number(match.group(1))
    except Exception:
        return None


def significant_tokens(text):
    low = engine.normalize(text)
    tokens = re.findall(r"[a-z0-9]+", low)

    return [
        token
        for token in tokens
        if len(token) >= 3 and token not in GENERIC_WORDS
    ]


def score_catalog_match(text, config):
    low = engine.normalize(text)
    score = 0

    try:
        if engine.matches_catalog(text, config):
            score += 200
    except Exception:
        pass

    try:
        if engine.related_to_catalog_without_box(text, config):
            score += 100
    except Exception:
        pass

    for alias in ALIASES.get(config["name"], []):
        if engine.normalize(alias) in low:
            score += 80

    name_tokens = significant_tokens(config["name"])
    query_tokens = significant_tokens(config.get("query", ""))
    all_tokens = set(name_tokens + query_tokens)

    for token in all_tokens:
        if token in low:
            score += 10

    if "pokemon" in low and "pokémon" in engine.normalize(config["name"]):
        score += 5

    if "one piece" in low and "one piece" in engine.normalize(config["name"]):
        score += 20

    if "lorcana" in low and "lorcana" in engine.normalize(config["name"]):
        score += 20

    if "topps" in low and "topps" in engine.normalize(config["name"]):
        score += 20

    return score


def find_catalog(product_text):
    scored = []

    for config in engine.CATALOG:
        score = score_catalog_match(product_text, config)
        scored.append((score, config))

    scored.sort(key=lambda x: x[0], reverse=True)

    best_score, best_config = scored[0]

    if best_score < 20:
        return None, best_score, scored[:5]

    return best_config, best_score, scored[:5]


def get_reference(config):
    error = None

    try:
        found = engine.pricecharting_search(config)

        if found:
            return found[0], None

        time.sleep(1)

    except Exception as e:
        error = str(e)

    fallback = engine.build_internal_reference(config)

    return fallback, error


def format_rejected(result):
    offer = result["offer"]
    ref = result.get("reference")

    ref_name = ref.get("catalog_name") if ref else "Aucune référence"
    ref_source = ref.get("reference_source") if ref else "Aucune"

    return f"""⚠️ DEAL HUNTER AI V7.1 — ANALYSE MANUELLE REJETÉE

Produit :
{offer.get("title")}

Prix :
{offer.get("price_chf")} CHF

Source :
{offer.get("source")}

Pays vendeur :
{offer.get("seller_country")}

Référence reconnue :
{ref_name}

Source référence :
{ref_source}

Confiance vendeur :
{result.get("seller_confidence_label")} — {result.get("seller_confidence_score")}/100

Raison rejet :
{result.get("reason")}

Action :
{result.get("action_recommended")}

Lien :
{offer.get("url") or "Aucun lien fourni"}
"""


def format_analysis(result):
    offer = result["offer"]
    ref = result["reference"]

    evidence_block = market_evidence.format_evidence_block(ref.get("catalog_name"))

    analysis_block = f"""🧮 DEAL HUNTER AI V7.1 — ANALYSE MANUELLE

Produit reconnu :
{ref.get("catalog_name")}

Texte analysé :
{offer.get("title")}

Prix actuel :
{offer.get("price_chf")} CHF

Décision flip :
{result.get("flip_decision")}

Décision marché :
{result.get("market_decision")}

Confiance vendeur :
{result.get("seller_confidence_label")} — {result.get("seller_confidence_score")}/100

Risque vendeur :
{result.get("seller_risk")}

Action recommandée :
{result.get("action_recommended")}

Prix max flip :
{result.get("target_buy_price")} CHF

Écart flip :
{result.get("gap_text")}

Prix marché effectif :
{result.get("market_effective_price")} CHF

Fourchette marché :
{result.get("market_range_text")}

Écart marché :
{result.get("market_gap_text")}

Prix référence :
{ref.get("main_chf")} CHF

Source référence :
{ref.get("reference_source")}

Confiance référence :
{ref.get("confidence")}

Source offre :
{offer.get("source")}

Pays vendeur :
{offer.get("seller_country")}

Profit flip estimé :
{result.get("profit")} CHF

ROI flip :
{result.get("roi")} %

Raison :
{result.get("reason") or "Analyse terminée"}

Lien :
{offer.get("url") or "Aucun lien fourni"}
"""

    return analysis_block + "\n\n" + evidence_block


def main():
    product_text = env_text("MANUAL_PRODUCT_TEXT")
    price_raw = env_text("MANUAL_PRICE_CHF")
    source = env_text("MANUAL_SOURCE", "Manual")
    seller_country_input = env_text("MANUAL_SELLER_COUNTRY")
    url = env_text("MANUAL_URL")

    if not product_text or not price_raw:
        engine.send_telegram(
            """⚠️ DEAL HUNTER AI V7.0 — ERREUR ANALYSE MANUELLE

Il manque le produit ou le prix.

Exemple :
Produit : Terastal Festival Booster Box
Prix : 72 CHF
Source : eBay
Pays vendeur : UNKNOWN
"""
        )
        return

    price_chf = parse_manual_price(price_raw)

    if price_chf is None or price_chf <= 0:
        engine.send_telegram(
            f"""⚠️ DEAL HUNTER AI V7.0 — PRIX INVALIDE

Produit :
{product_text}

Prix reçu :
{price_raw}

Action :
Relancer avec un prix simple, par exemple 72 CHF.
"""
        )
        return

    config, score, alternatives = find_catalog(product_text)

    if not config:
        suggestions = "\n".join(
            [f"- {item[1]['name']} score {item[0]}" for item in alternatives]
        )

        engine.send_telegram(
            f"""⚠️ DEAL HUNTER AI V7.0 — PRODUIT NON RECONNU

Texte reçu :
{product_text}

Prix :
{price_chf} CHF

Meilleures correspondances :
{suggestions}

Action :
Relancer avec un nom plus précis, par exemple :
Terastal Festival Booster Box
Pokémon 151 JP Booster Box
One Piece OP-13 Carrying On His Will Booster Box
"""
        )
        return

    ref, ref_error = get_reference(config)

    if not ref:
        engine.send_telegram(
            f"""⚠️ DEAL HUNTER AI V7.0 — AUCUNE RÉFÉRENCE

Produit reconnu :
{config["name"]}

Erreur référence :
{ref_error or "Aucune référence disponible"}

Action :
Impossible d'analyser proprement ce produit pour le moment.
"""
        )
        return

    if seller_country_input:
        seller_country = seller_country_input.upper()
    else:
        seller_country = engine.detect_seller_country(source, url)

    forced_reject_reason = None

    if engine.is_bad_source(source, url, product_text):
        forced_reject_reason = "Source à risque exclue"

    elif engine.is_booster_box_config(config) and engine.is_wrong_booster_box_type(product_text):
        forced_reject_reason = "Mauvais type de produit : Special Set / collection / lot / case / jumbo ≠ vraie booster box"

    offer = {
        "title": engine.clean_product_text(product_text),
        "price_chf": price_chf,
        "currency": "CHF",
        "source": f"Manual / {source}",
        "platform": source,
        "seller_country": seller_country,
        "search_country": "MANUAL",
        "url": url,
        "raw_price": price_raw,
        "delivery": "Analyse manuelle",
        "catalog_name": config["name"],
        "is_active": True,
        "forced_reject_reason": forced_reject_reason,
    }

    result = engine.evaluate_offer(offer, ref)

    if result["direction"] == "REJECTED":
        engine.send_telegram(format_rejected(result))
    else:
        engine.send_telegram(format_analysis(result))


if __name__ == "__main__":
    main()