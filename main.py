import os, re, requests, urllib.parse
from bs4 import BeautifulSoup
from datetime import datetime

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

MAX_RESULTS_TO_SEND = 10

SEARCHES = [
    'site:ebay.com/itm pokemon japanese booster box sealed',
    'site:ebay.com/itm pokemon eevee heroes booster box',
    'site:ebay.com/itm pokemon evolving skies booster box sealed',
    'site:ebay.com/itm pokemon vstar universe booster box',
    'site:ebay.com/itm pokemon terastal festival booster box',
    'site:ebay.com/itm pokemon 151 japanese booster box',
    'site:ebay.com/itm pokemon center etb sealed',
    'site:ebay.com/itm pokemon psa 10 alt art',
    'site:ebay.com/itm topps chrome hobby box',
    'site:ebay.com/itm topps chrome uefa hobby box',
    'site:ebay.com/itm panini prizm hobby box',
    'site:ebay.com/itm one piece booster box sealed',
    'site:ricardo.ch pokemon scellé display',
    'site:ricardo.ch pokemon booster box',
    'site:ricardo.ch topps chrome',
    'site:anibis.ch pokemon scellé',
    'site:tutti.ch pokemon scellé',
    'site:cardmarket.com pokemon booster box sealed'
]

BAD_WORDS = [
    "sticker", "stickers", "album", "empty", "wrapper", "digital",
    "proxy", "custom", "repack", "mystery", "random", "break",
    "match attax", "adrenalyn", "opened", "damaged",
    "german", "deutsch", "italian", "spanish", "espanol", "español"
]

PREMIUM_WORDS = [
    "sealed", "scellé", "scelle", "booster box", "display", "etb",
    "elite trainer", "pokemon center", "japanese", "psa 10",
    "alt art", "sar", "charizard", "pikachu", "eevee heroes",
    "evolving skies", "151", "vstar universe", "terastal festival",
    "topps chrome", "sapphire", "hobby box", "panini prizm",
    "one piece", "lorcana"
]

def send_telegram(message):
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {"chat_id": TELEGRAM_CHAT_ID, "text": message[:3900], "disable_web_page_preview": False}
    r = requests.post(url, json=payload, timeout=20)
    print("Telegram:", r.status_code, r.text[:200])

def clean_duck_url(href):
    if not href:
        return ""
    if "uddg=" in href:
        parsed = urllib.parse.urlparse(href)
        qs = urllib.parse.parse_qs(parsed.query)
        if "uddg" in qs:
            return urllib.parse.unquote(qs["uddg"][0])
    return href

def score(title, url, query):
    text = f"{title} {url} {query}".lower()
    s = 35

    for bad in BAD_WORDS:
        if bad in text:
            s -= 50

    for word in PREMIUM_WORDS:
        if word in text:
            s += 6

    if "ebay.com/itm" in text:
        s += 10
    if "ricardo.ch" in text:
        s += 12
    if "cardmarket" in text:
        s += 10
    if "eevee heroes" in text or "evolving skies" in text:
        s += 15
    if "pokemon center" in text:
        s += 12
    if "psa 10" in text:
        s += 10

    return max(0, min(100, s))

def verdict(s):
    if s >= 90:
        return "🔥 PRIORITÉ HAUTE"
    if s >= 80:
        return "🟢 TRÈS INTÉRESSANT"
    if s >= 70:
        return "🟡 À ANALYSER"
    return "⚪ DEBUG"

def search_duckduckgo(query):
    print("Searching:", query)

    url = "https://html.duckduckgo.com/html/"
    headers = {"User-Agent": "Mozilla/5.0"}
    r = requests.post(url, data={"q": query}, headers=headers, timeout=25)

    print("Status:", r.status_code, "Length:", len(r.text))

    soup = BeautifulSoup(r.text, "html.parser")
    results = []

    for a in soup.select("a.result__a")[:8]:
        title = a.get_text(" ", strip=True)
        link = clean_duck_url(a.get("href", ""))

        if not title or not link.startswith("http"):
            continue

        if any(bad in title.lower() for bad in BAD_WORDS):
            continue

        results.append({
            "title": title,
            "url": link,
            "query": query,
            "score": score(title, link, query)
        })

    return results

def main():
    print("🚀 Deal Hunter AI started", datetime.utcnow().isoformat(), "UTC")

    all_results = []

    for q in SEARCHES:
        try:
            all_results.extend(search_duckduckgo(q))
        except Exception as e:
            print("ERROR:", q, e)

    unique = []
    seen = set()

    for r in sorted(all_results, key=lambda x: x["score"], reverse=True):
        if r["url"] in seen:
            continue
        seen.add(r["url"])
        unique.append(r)

    selected = unique[:MAX_RESULTS_TO_SEND]

    send_telegram(f"""🔎 DEAL HUNTER AI — PASSAGE WEB

Résultats trouvés :
{len(unique)}

Résultats envoyés :
{len(selected)}

Sources :
DuckDuckGo → eBay / Ricardo / Anibis / Tutti / Cardmarket

Mode :
Calibration. On vérifie maintenant que le robot récupère enfin de vraies annonces.""")

    if not selected:
        send_telegram("⚠️ Aucun résultat récupéré. La source DuckDuckGo n'a rien renvoyé sur ce passage.")
        return

    for d in selected:
        send_telegram(f"""🚨 DEAL HUNTER AI — RÉSULTAT

Score :
{d['score']}/100

Verdict :
{verdict(d['score'])}

Produit :
{d['title']}

Recherche :
{d['query']}

Lien :
{d['url']}

Analyse :
Résultat réel récupéré via recherche web. Ce n'est pas encore une recommandation d'achat.

À vérifier :
- prix exact
- frais vers Suisse
- ventes réalisées
- liquidité
- vendeur
- scellage / authenticité""")

    print("Sent", len(selected), "results")

if __name__ == "__main__":
    main()