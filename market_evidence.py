import csv
import os
from datetime import datetime, timedelta
from statistics import median


SALES_FILE = "sales_comps.csv"


def safe_float(value, default=0.0):
    try:
        if value is None:
            return default
        value = str(value).replace("CHF", "").replace(",", ".").strip()
        if value == "":
            return default
        return float(value)
    except Exception:
        return default


def safe_int(value, default=1):
    try:
        if value is None:
            return default
        value = str(value).strip()
        if value == "":
            return default
        return int(float(value))
    except Exception:
        return default


def parse_date(value):
    try:
        return datetime.strptime(str(value).strip(), "%Y-%m-%d").date()
    except Exception:
        return None


def normalize(text):
    return str(text or "").lower().strip()


def load_sales_comps(path=SALES_FILE):
    if not os.path.exists(path):
        return []

    rows = []

    try:
        with open(path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)

            for row in reader:
                catalog_name = str(row.get("catalog_name") or "").strip()
                sold_date = parse_date(row.get("sold_date"))
                source = str(row.get("source") or "").strip()
                title = str(row.get("title") or "").strip()
                sold_price_chf = safe_float(row.get("sold_price_chf"))
                shipping_chf = safe_float(row.get("shipping_chf"))
                quantity = safe_int(row.get("quantity"), 1)
                url = str(row.get("url") or "").strip()
                confidence = safe_int(row.get("confidence"), 50)
                notes = str(row.get("notes") or "").strip()

                if not catalog_name or not sold_date or sold_price_chf <= 0:
                    continue

                if quantity <= 0:
                    quantity = 1

                unit_total_chf = round((sold_price_chf + shipping_chf) / quantity, 2)

                rows.append(
                    {
                        "catalog_name": catalog_name,
                        "sold_date": sold_date,
                        "source": source,
                        "title": title,
                        "sold_price_chf": sold_price_chf,
                        "shipping_chf": shipping_chf,
                        "quantity": quantity,
                        "unit_total_chf": unit_total_chf,
                        "url": url,
                        "confidence": confidence,
                        "notes": notes,
                    }
                )

    except Exception as e:
        print("sales_comps read error:", e)

    return rows


def sales_for_catalog(catalog_name, days=90):
    today = datetime.utcnow().date()
    cutoff = today - timedelta(days=days)

    rows = load_sales_comps()
    target = normalize(catalog_name)

    matched = []

    for row in rows:
        if normalize(row["catalog_name"]) != target:
            continue

        if row["sold_date"] < cutoff:
            continue

        matched.append(row)

    return matched


def compute_market_evidence(catalog_name):
    sales_30 = sales_for_catalog(catalog_name, days=30)
    sales_90 = sales_for_catalog(catalog_name, days=90)

    prices_90 = [row["unit_total_chf"] for row in sales_90 if row["unit_total_chf"] > 0]
    prices_30 = [row["unit_total_chf"] for row in sales_30 if row["unit_total_chf"] > 0]

    if not prices_90:
        return {
            "catalog_name": catalog_name,
            "sales_30_count": 0,
            "sales_90_count": 0,
            "median_sold_chf": None,
            "low_sold_chf": None,
            "high_sold_chf": None,
            "evidence_score": 0,
            "liquidity_label": "🔴 Aucune vente réelle renseignée",
            "evidence_decision": "🟠 Opportunité non confirmée par ventes réelles",
            "evidence_action": "Ne pas acheter automatiquement. Ajouter des ventes réelles dans sales_comps.csv.",
            "latest_sales": [],
        }

    median_price = round(median(prices_90), 2)
    low_price = round(min(prices_90), 2)
    high_price = round(max(prices_90), 2)

    sales_count = len(prices_90)

    if sales_count >= 8:
        liquidity_label = "🟢 Bonne liquidité"
        score = 90
    elif sales_count >= 5:
        liquidity_label = "🟢 Liquidité correcte"
        score = 80
    elif sales_count >= 3:
        liquidity_label = "🟡 Liquidité limitée mais exploitable"
        score = 65
    elif sales_count >= 1:
        liquidity_label = "🟠 Trop peu de ventes"
        score = 40
    else:
        liquidity_label = "🔴 Aucune vente"
        score = 0

    avg_confidence = round(
        sum(row["confidence"] for row in sales_90) / max(1, len(sales_90)),
        1,
    )

    if avg_confidence < 60:
        score -= 15
    elif avg_confidence >= 80:
        score += 5

    score = max(0, min(100, score))

    if score >= 75:
        decision = "🟢 Opportunité confirmable par ventes réelles"
        action = "Les ventes réelles soutiennent l'analyse. Vérifier produit exact et vendeur avant achat."
    elif score >= 55:
        decision = "🟡 Preuve marché partielle"
        action = "Possible, mais ajouter plus de ventes comparables avant achat important."
    else:
        decision = "🟠 Preuve marché insuffisante"
        action = "Ne pas acheter automatiquement. Il faut plus de ventes réelles."

    latest_sales = sorted(sales_90, key=lambda x: x["sold_date"], reverse=True)[:5]

    return {
        "catalog_name": catalog_name,
        "sales_30_count": len(prices_30),
        "sales_90_count": len(prices_90),
        "median_sold_chf": median_price,
        "low_sold_chf": low_price,
        "high_sold_chf": high_price,
        "evidence_score": score,
        "liquidity_label": liquidity_label,
        "evidence_decision": decision,
        "evidence_action": action,
        "latest_sales": latest_sales,
    }


def format_evidence_block(catalog_name):
    evidence = compute_market_evidence(catalog_name)

    median_text = (
        f"{evidence['median_sold_chf']} CHF"
        if evidence["median_sold_chf"] is not None
        else "Aucune"
    )

    range_text = (
        f"{evidence['low_sold_chf']}–{evidence['high_sold_chf']} CHF"
        if evidence["low_sold_chf"] is not None
        else "Aucune"
    )

    latest_lines = []

    for sale in evidence["latest_sales"]:
        latest_lines.append(
            f"- {sale['sold_date']} | {sale['source']} | {sale['unit_total_chf']} CHF | confiance {sale['confidence']}/100"
        )

    latest_text = "\n".join(latest_lines) if latest_lines else "Aucune vente renseignée"

    return f"""📈 PREUVES DE MARCHÉ — VENTES RÉELLES

Produit :
{catalog_name}

Ventes réelles 30 jours :
{evidence['sales_30_count']}

Ventes réelles 90 jours :
{evidence['sales_90_count']}

Prix médian vendu 90 jours :
{median_text}

Fourchette ventes 90 jours :
{range_text}

Liquidité :
{evidence['liquidity_label']}

Score preuve marché :
{evidence['evidence_score']}/100

Décision preuve :
{evidence['evidence_decision']}

Action preuve :
{evidence['evidence_action']}

Dernières ventes renseignées :
{latest_text}
"""
