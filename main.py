import os
import re
import requests
from bs4 import BeautifulSoup
from datetime import datetime

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

SEARCHES = [
    "pokemon booster box sealed",
    "pokemon elite trainer box sealed",
    "pokemon 151 sealed box",
    "pokemon evolving skies sealed",
    "pokemon center etb sealed",
    "topps chrome hobby box",
    "topps chrome uefa hobby box",
    "topps chrome marvel box",
    "topps sapphire box",
    "panini prizm hobby box",
    "panini prizm blaster box",
    "one piece booster box sealed",
    "lorcana booster box sealed",
]

BAD_WORDS = [
    "sticker", "stickers", "album", "empty", "wrapper", "digital",
    "proxy", "custom", "repack", "mystery", "random", "break",
    "case break", "match attax", "adrenalyn", "hero attax",
    "opened", "damaged", "loose pack"
]

STRONG_WORDS = [
    "sealed", "factory sealed", "booster box", "hobby box", "etb",
    "elite trainer box", "pokemon center", "chrome", "sapphire",
    "prizm", "select", "optic", "marvel", "uefa", "one piece",
    "lorcana", "japanese", "case", "auto", "autograph", "numbered"
]

def send_telegram(message):
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": message,
        "disable_web_page_preview": False
    }
    r = requests.post(url, json=payload, timeout=20)
    print("Telegram:", r.status_code, r.text[:200])

def score_deal(title, price_text, query):
    text = f"{title} {price_text} {query}".lower()
    score = 50

    for word in STRONG_WORDS:
        if word in text:
            score += 5

    if "sealed" in text:
        score += 10
    if "hobby box" in text:
        score += 12
    if "booster box" in text:
        score += 12
    if "pokemon center" in text:
        score += 10
    if "sapphire" in text:
        score += 10
    if "chrome" in text:
        score += 8
    if "prizm" in text:
        score += 8

    for bad in BAD_WORDS:
        if bad in text:
            score -= 60

    return max(0, min(100, score))

def clean_url(url):
    match = re.search(r"https://www\.ebay\.[^/]+/itm/\d+", url)
    return match.group(0) if match else url.split("?")[0]

def search_ebay(query):
    url = "https://www.ebay.com/sch/i.html"
    params = {
        "_nkw": query,
        "_sop": "10",
        "LH_BIN": "1"
    }

    headers = {
        "User-Agent": "Mozilla/5.0"
    }

    print(f"Searching eBay: {query}")
    r = requests.get(url, params=params, headers=headers, timeout=25)
    soup = BeautifulSoup(r.text, "html.parser")

    results = []

    for item in soup.select("li.s-item")[:12]:
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

        if score >= 75:
            results.append({
                "title": title,
                "price": price,
                "link": link,
                "query": query,
                "score": score
            })

    return results

def main():
    print("🚀 Deal Hunter AI started")
    print("Time:", datetime.utcnow().isoformat(), "UTC")

    all_deals = []

    for query in SEARCHES:
        try:
            deals = search_ebay(query)
            all_deals.extend(deals)
        except Exception as e:
            print("Error on query:", query, e)

    all_deals = sorted(all_deals, key=lambda x: x["score"], reverse=True)
    top_deals = all_deals[:5]

    if not top_deals:
        send_telegram("✅ Deal Hunter AI lancé.\n\nAucune opportunité forte détectée sur ce passage.")
        print("No strong deals found.")
        return

    for deal in top_deals:
        message = f"""🚨 DEAL HUNTER AI

Score : {deal['score']}/100

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
Produit détecté comme potentiellement intéressant selon les mots-clés premium.

À vérifier avant achat :
- prix total livré Suisse
- photos réelles
- scellage
- vendeur
- ventes similaires
- liquidité réelle

Verdict :
À ANALYSER AVANT ACHAT. Ne pas acheter automatiquement."""

        send_telegram(message)

    print(f"✅ Sent {len(top_deals)} alerts")

if __name__ == "__main__":
    main()