import os
import re
import requests
from bs4 import BeautifulSoup
from datetime import datetime

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

JPY_TO_CHF = 0.0058
ESTIMATED_JP_SHIPPING_CHF = 18
ESTIMATED_IMPORT_BUFFER_CHF = 8
MAX_ALERTS = 8

SEARCHES = [
    "pokemon booster box",
    "pokemon japanese booster box",
    "pokemon 151",
    "pokemon eevee heroes",
    "pokemon blue sky stream",
    "pokemon vstar universe",
    "pokemon vmax climax",
    "pokemon shiny treasure",
    "pokemon terastal festival",
    "pokemon dream league",
    "pokemon tag team gx",
    "pokemon clay burst",
    "pokemon crimson haze",
    "pokemon pikachu promo",
    "pokemon charizard",
]

SWISS_MARKET = {
    "eevee heroes": (420, 550),
    "blue sky stream": (130, 190),
    "dream league": (230, 330),
    "tag team": (220, 380),
    "151": (115, 145),
    "vstar universe": (95, 130),
    "vmax climax": (130, 180),
    "shiny treasure": (65, 95),
    "terastal festival": (85, 120),
    "clay burst": (90, 135),
    "crimson haze": (70, 105),
    "charizard": (80, 250),
    "pikachu": (60, 220),
}

BAD_WORDS = [
    "sticker", "album", "opened", "damaged", "proxy", "fake",
    "custom", "orica", "repack", "mystery", "digital", "empty",
    "wrapper", "german", "deutsch", "italian", "spanish"
]

PREMIUM_WORDS = [
    "booster box", "box", "sealed", "unopened", "pokemon",
    "pocket monster", "japanese", "eevee heroes", "151",
    "vstar universe", "vmax climax", "terastal festival",
    "blue sky stream", "dream league", "tag team", "charizard", "pikachu"
]

def send_telegram(msg):
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": msg[:3900],
        "disable_web_page_preview": False
    }
    r = requests.post(url, json=payload, timeout=20)
    print("Telegram:", r.status_code, r.text[:200])

def yen_to_chf(yen):
    if yen is None:
        return None
    return round(yen * JPY_TO_CHF, 2)

def extract_yen(text):
    if not text:
        return None
    cleaned = text.replace(",", "")
    match = re.search(r"¥\s?(\d+)", cleaned)
    if match:
        return int(match.group(1))
    match = re.search(r"(\d{3,7})\s?yen", cleaned.lower())
    if match:
        return int(match.group(1))
    return None

def swiss_market_value(title):
    t = title.lower()
    for key, value in SWISS_MARKET.items():
        if key in t:
            return value
    return None

def is_bad(title):
    t = title.lower()
    return any(bad in t for bad in BAD_WORDS)

def score_item(title, total_chf, swiss_range):
    t = title.lower()
    score = 40

    if is_bad(t):
        return 0

    for word in PREMIUM_WORDS:
        if word in t:
            score += 5

    if swiss_range and total_chf:
        swiss_low, swiss_high = swiss_range
        swiss_mid = (swiss_low + swiss_high) / 2
        discount = (swiss_mid - total_chf) / swiss_mid

        if discount >= 0.35:
            score += 35
        elif discount >= 0.25:
            score += 25
        elif discount >= 0.15:
            score += 15
        elif discount <= 0:
            score -= 25

    if "eevee heroes" in t:
        score += 15
    if "151" in t:
        score += 10
    if "vstar universe" in t or "vmax climax" in t:
        score += 8

    return max(0, min(100, score))

def verdict(score):
    if score >= 90:
        return "🔥 PRIORITÉ HAUTE — vérifier immédiatement"
    if score >= 80:
        return "🟢 Très intéressant"
    if score >= 70:
        return "🟡 Potentiel correct"
    if score >= 55:
        return "⚪ À surveiller"
    return "❌ Ignorer"

def mandarake_search(query):
    url = "https://order.mandarake.co.jp/order/listPage/list"
    params = {"keyword": query, "lang": "en"}

    r = requests.get(
        url,
        params=params,
        headers={"User-Agent": "Mozilla/5.0"},
        timeout=30
    )

    soup = BeautifulSoup(r.text, "html.parser")
    results = []

    for a in soup.select("a")[:200]:
        title = a.get_text(" ", strip=True)
        href = a.get("href", "")

        if not title or len(title) < 10:
            continue

        low = title.lower()
        if "pokemon" not in low and "pocket monster" not in low:
            continue

        if is_bad(title):
            continue

        parent_text = a.parent.get_text(" ", strip=True) if a.parent else title
        yen = extract_yen(parent_text)

        link = href if href.startswith("http") else "https://order.mandarake.co.jp" + href

        results.append({
            "source": "Mandarake JP",
            "title": title,
            "price_yen": yen,
            "url": link,
            "query": query
        })

    return results[:12]

def pricecharting_reference(query):
    url = "https://www.pricecharting.com/search-products"
    params = {"q": query, "type": "prices"}

    try:
        r = requests.get(
            url,
            params=params,
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=30
        )
        soup = BeautifulSoup(r.text, "html.parser")
        rows = []

        for row in soup.select("tr")[:10]:
            text = row.get_text(" ", strip=True)
            if "Pokemon" in text or "Pokémon" in text:
                rows.append(text[:180])

        return rows[:3]
    except Exception:
        return []

def main():
    print("Deal Hunter AI Mandarake + Swiss Market", datetime.utcnow().isoformat())

    all_items = []

    for query in SEARCHES:
        try:
            items = mandarake_search(query)
            print(query, "=>", len(items))
            all_items.extend(items)
        except Exception as e:
            print("Mandarake error:", query, e)

    unique = []
    seen = set()

    for item in all_items:
        key = item["url"]
        if key in seen:
            continue
        seen.add(key)

        chf = yen_to_chf(item["price_yen"])
        total_chf = None

        if chf is not None:
            total_chf = round(chf + ESTIMATED_JP_SHIPPING_CHF + ESTIMATED_IMPORT_BUFFER_CHF, 2)

        swiss_range = swiss_market_value(item["title"])
        score = score_item(item["title"], total_chf, swiss_range)

        item["price_chf"] = chf
        item["total_chf"] = total_chf
        item["swiss_range"] = swiss_range
        item["score"] = score

        unique.append(item)

    ranked = sorted(unique, key=lambda x: x["score"], reverse=True)[:MAX_ALERTS]

    send_telegram(f"""🔎 DEAL HUNTER AI — MANDARAKE + MARCHÉ SUISSE

Source achat :
Mandarake Japon

Comparaison :
Base interne marché suisse CHF + PriceCharting indicatif

Produits analysés :
{len(unique)}

Alertes envoyées :
{len(ranked)}

Note :
Les prix suisses sont des estimations internes à affiner avec Ricardo / boutiques CH plus tard.
""")

    if not ranked:
        send_telegram("Aucun résultat Mandarake exploitable trouvé sur ce passage.")
        return

    for item in ranked:
        title = item["title"]
        swiss = item["swiss_range"]
        total = item["total_chf"]

        if swiss:
            swiss_text = f"{swiss[0]}–{swiss[1]} CHF"
            if total:
                margin_low = round(swiss[0] - total, 2)
                margin_high = round(swiss[1] - total, 2)
                margin_text = f"{margin_low} à {margin_high} CHF"
            else:
                margin_text = "Non calculable"
        else:
            swiss_text = "Non identifié dans la base suisse"
            margin_text = "Non calculable"

        pc_refs = pricecharting_reference(title)
        pc_text = "\n".join(f"- {x}" for x in pc_refs) if pc_refs else "Aucune référence PriceCharting claire."

        msg = f"""🚨 DEAL HUNTER AI

Score :
{item['score']}/100

Verdict :
{verdict(item['score'])}

Produit :
{title}

Prix Japon :
{item['price_yen'] if item['price_yen'] else 'Non extrait'} JPY

Prix estimé CHF :
{item['price_chf'] if item['price_chf'] else 'Non extrait'} CHF

Coût total estimé livré Suisse :
{total if total else 'Non calculable'} CHF

Marché suisse estimé :
{swiss_text}

Marge potentielle :
{margin_text}

Références PriceCharting :
{pc_text}

Source :
Mandarake JP

Recherche :
{item['query']}

Lien :
{item['url']}

À vérifier avant achat :
- produit bien scellé / unopened
- frais réels vers la Suisse
- disponibilité réelle
- état de la boîte
- TVA / douane
- comparaison Ricardo / boutiques suisses
"""
        send_telegram(msg)

if __name__ == "__main__":
    main()