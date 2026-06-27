import os
import re
import requests
from bs4 import BeautifulSoup
from datetime import datetime

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

SEARCHES = [
    "pokemon 151 booster box",
    "pokemon eevee heroes booster box",
    "pokemon vstar universe booster box",
    "pokemon vmax climax booster box",
    "pokemon terastal festival booster box",
    "pokemon evolving skies booster box",
    "pokemon blue sky stream booster box",
    "pokemon dream league booster box",
    "pokemon shiny treasure ex booster box",
    "topps chrome uefa hobby box",
    "panini prizm hobby box",
    "one piece booster box",
    "lorcana booster box"
]

SWISS_MARKET = {
    "151": (115, 145),
    "eevee heroes": (420, 550),
    "vstar universe": (95, 130),
    "vmax climax": (130, 180),
    "terastal festival": (85, 120),
    "evolving skies": (650, 850),
    "blue sky stream": (130, 190),
    "dream league": (230, 330),
    "shiny treasure": (65, 95),
    "topps chrome uefa": (90, 150),
    "panini prizm": (90, 180),
    "one piece": (90, 150),
    "lorcana": (90, 140),
}

def send(msg):
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    requests.post(url, json={"chat_id": TELEGRAM_CHAT_ID, "text": msg[:3900]}, timeout=20)

def swiss_range(title):
    t = title.lower()
    for key, value in SWISS_MARKET.items():
        if key in t:
            return value
    return None

def extract_prices(text):
    prices = re.findall(r"\$?\d+(?:\.\d{2})?", text)
    return prices[:5]

def score(title):
    t = title.lower()
    s = 45

    premium = [
        "151", "eevee heroes", "evolving skies", "vstar universe",
        "vmax climax", "terastal festival", "blue sky stream",
        "dream league", "topps chrome", "panini prizm",
        "one piece", "lorcana", "booster box"
    ]

    for word in premium:
        if word in t:
            s += 7

    return min(100, s)

def verdict(s):
    if s >= 90:
        return "🔥 Produit prioritaire à surveiller"
    if s >= 80:
        return "🟢 Très intéressant"
    if s >= 70:
        return "🟡 Bon potentiel"
    return "⚪ Référence marché"

def pricecharting_search(query):
    url = "https://www.pricecharting.com/search-products"
    params = {"q": query, "type": "prices"}

    r = requests.get(url, params=params, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
    soup = BeautifulSoup(r.text, "html.parser")

    results = []

    for row in soup.select("tr")[:20]:
        text = row.get_text(" ", strip=True)

        if not text:
            continue

        if "Pokemon" not in text and "Pokémon" not in text and "Topps" not in text and "Panini" not in text and "One Piece" not in text and "Lorcana" not in text:
            continue

        link_el = row.select_one("a")
        link = ""
        if link_el:
            href = link_el.get("href", "")
            link = href if href.startswith("http") else "https://www.pricecharting.com" + href

        results.append({
            "query": query,
            "text": text[:300],
            "url": link,
            "prices": extract_prices(text)
        })

    return results[:5]

def main():
    all_results = []

    for q in SEARCHES:
        try:
            all_results.extend(pricecharting_search(q))
        except Exception as e:
            print("Erreur:", q, e)

    send(f"""🔎 DEAL HUNTER AI — MARCHÉ V1

Source active :
PriceCharting

But :
Construire la base de comparaison marché pendant que l'API eBay est en attente.

Recherches :
{len(SEARCHES)}

Références trouvées :
{len(all_results)}

Heure :
{datetime.utcnow().isoformat()} UTC
""")

    if not all_results:
        send("⚠️ Aucune référence marché trouvée.")
        return

    for item in all_results[:10]:
        title = item["text"]
        s = score(title)
        swiss = swiss_range(title)

        swiss_text = f"{swiss[0]}–{swiss[1]} CHF" if swiss else "Non encore dans base suisse"
        price_text = ", ".join(item["prices"]) if item["prices"] else "Non extrait"

        send(f"""📊 DEAL HUNTER AI — RÉFÉRENCE MARCHÉ

Score :
{s}/100

Verdict :
{verdict(s)}

Recherche :
{item['query']}

Produit / référence :
{title}

Prix détectés PriceCharting :
{price_text}

Marché suisse estimé :
{swiss_text}

Lien :
{item['url']}

Utilité :
Cette référence servira à comparer les futures annonces réelles.
""")

if __name__ == "__main__":
    main()