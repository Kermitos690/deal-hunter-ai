import os
import re
import requests
from bs4 import BeautifulSoup
from datetime import datetime

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

MAX_RESULTS_TO_SEND = 5

SEARCHES = [
    "pokemon japanese booster box sealed",
    "pokemon 151 japanese booster box sealed",
    "pokemon vstar universe booster box sealed",
    "pokemon shiny treasure ex booster box sealed",
    "pokemon terastal festival booster box sealed",
    "pokemon eevee heroes booster box sealed",
    "pokemon evolving skies booster box sealed",
    "pokemon booster box sealed",
    "pokemon elite trainer box sealed",
    "pokemon center etb sealed",
    "pokemon sealed collection lot",
    "pokemon psa 10 alt art",
    "topps chrome hobby box",
    "topps chrome uefa hobby box",
    "topps chrome marvel box",
    "panini prizm hobby box",
    "one piece booster box sealed",
    "lorcana booster box sealed",
]

BAD_WORDS = [
    "sticker", "stickers", "album", "empty", "wrapper", "digital",
    "proxy", "custom", "repack", "mystery", "random", "break",
    "case break", "live break", "opened", "damaged", "loose pack",
    "code card", "no cards", "empty box"
]

PREMIUM_WORDS = [
    "sealed", "booster box", "display", "elite trainer box", "etb",
    "pokemon center", "japanese", "151", "vstar universe",
    "shiny treasure", "terastal festival", "eevee heroes",
    "evolving skies", "psa 10", "alt art", "sar", "charizard",
    "pikachu", "chrome", "hobby box", "prizm", "one piece", "lorcana"
]

def send_telegram(message):
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        print("Missing Telegram secrets")
        return

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": message[:3900],
        "disable_web_page_preview": False
    }

    r = requests.post(url, json=payload, timeout=20)
    print("Telegram:", r.status_code, r.text[:200])

def clean_url(url):
    match = re.search(r"https://www\.ebay\.[^/]+/itm/\d+", url)
    return match.group(0) if match else url.split("?")[0]

def score_deal(title, price, query):
    text = f"{title} {price} {query}".lower()
    score = 40

    for bad in BAD_WORDS:
        if bad in text:
            score -= 50

    for word in PREMIUM_WORDS:
        if word in text:
            score += 5

    if "sealed" in text:
        score += 10
    if "booster box" in text:
        score += 12
    if "japanese" in text:
        score += 8
    if "pokemon center" in text:
        score += 10
    if "psa 10" in text:
        score += 8
    if "eevee heroes" in text or "evolving skies" in text:
        score += 15

    return max(0, min(100, score))

def search_ebay(query):
    print(f"Searching eBay: {query}")

    url = "https://www.ebay.com/sch/i.html"
    params = {
        "_nkw": query,
        "_sop": "10",
        "LH_BIN": "1"
    }

    headers = {
        "User-Agent": "Mozilla/5.0"
    }

    r = requests.get(url, params=params, headers=headers, timeout=25)
    soup = BeautifulSoup(r.text, "html.parser")

    results = []

    for item in soup.select("li.s-item")[:15]:
        title_el = item.select_one(".s-item__title")
        price_el = item.select_one(".s-item__price")
        link_el = item.select_one("a.s-item__link")

        if not title_el or not price_el or not link_el:
            continue

        title = title_el.get_text(" ", strip=True)
        price = price_el.get_text(" ", strip=True)
        link = clean_url(link_el.get("href", ""))

        if not title or "shop on ebay" in title.lower():
            continue

        score = score_deal(title, price, query)

        results.append({
            "title": title,
            "price": price,
            "link": link,
            "query": query,
            "score": score
        })

    return results

def main():
    print("Deal Hunter AI started")
    print("Time:", datetime.utcnow().isoformat(), "UTC")

    all_results = []

    for query in SEARCHES:
        try:
            all_results.extend(search_ebay(query))
        except Exception as e:
            print("Error:", query, e)

    unique = []
    seen_links = set()

    for result in sorted(all_results, key=lambda x: x["score"], reverse=True):
        if result["link"] in seen_links:
            continue
        seen_links.add(result["link"])
        unique.append(result)

    selected = unique[:MAX_RESULTS_TO_SEND]

    intro = f"""🔎 DEAL HUNTER AI — DEBUG

Passage terminé.

Résultats trouvés :
{len(unique)}

Résultats envoyés :
{len(selected)}

But :
Voir ce que le robot détecte réellement pour calibrer le score Pokémon / Topps / Panini."""

    send_telegram(intro)

    if not selected:
        send_telegram("Aucun résultat récupéré. Le scraping eBay est probablement limité ou bloqué sur ce passage.")
        print("No results found.")
        return

    for deal in selected:
        message = f"""🚨 DEAL HUNTER AI — TEST RESULT

Score :
{deal['score']}/100

Produit :
{deal['title']}

Prix :
{deal['price']}

Recherche :
{deal['query']}

Plateforme :
eBay

Lien :
{deal['link']}

Analyse :
Résultat envoyé en mode debug. Ce n'est pas encore une recommandation d'achat.

À vérifier :
- prix marché réel
- ventes réalisées
- frais Suisse
- scellage
- langue
- liquidité
- vendeur"""

        send_telegram(message)

    print(f"Sent {len(selected)} debug results")

if __name__ == "__main__":
    main()