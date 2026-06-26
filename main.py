import os
import re
import html
import requests
import xml.etree.ElementTree as ET
from datetime import datetime

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

MAX_RESULTS_TO_SEND = 8

SEARCHES = [
    # Pokémon JP / EN / FR premium
    "pokemon japanese booster box sealed",
    "pokemon booster box sealed",
    "pokemon display scelle pokemon",
    "pokemon display scellé",
    "pokemon coffret scelle",
    "pokemon coffret scellé",
    "pokemon elite trainer box sealed",
    "pokemon etb scelle",
    "pokemon pokemon center etb",
    "pokemon ultra premium collection sealed",
    "pokemon premium collection sealed",

    # Pokémon séries japonaises recherchées
    "pokemon eevee heroes booster box",
    "pokemon blue sky stream booster box",
    "pokemon dream league booster box",
    "pokemon tag team gx booster box",
    "pokemon vstar universe booster box",
    "pokemon vmax climax booster box",
    "pokemon shiny star v booster box",
    "pokemon shiny treasure ex booster box",
    "pokemon terastal festival booster box",
    "pokemon clay burst booster box",
    "pokemon ruler of the black flame booster box",
    "pokemon crimson haze booster box",
    "pokemon paradise dragona booster box",
    "pokemon super electric breaker booster box",
    "pokemon battle partners booster box",

    # Pokémon anglais recherchés
    "pokemon evolving skies booster box sealed",
    "pokemon chilling reign booster box sealed",
    "pokemon fusion strike booster box sealed",
    "pokemon brilliant stars booster box sealed",
    "pokemon lost origin booster box sealed",
    "pokemon silver tempest booster box sealed",
    "pokemon crown zenith sealed",
    "pokemon 151 sealed english",
    "pokemon paldean fates sealed",
    "pokemon temporal forces sealed",
    "pokemon twilight masquerade sealed",
    "pokemon surging sparks sealed",
    "pokemon prismatic evolutions sealed",

    # Lots Pokémon
    "pokemon sealed collection lot",
    "pokemon sealed product lot",
    "lot pokemon scelle",
    "lot pokemon scellé",
    "stock pokemon scelle",
    "collection pokemon scellee",
    "collection pokemon scellée",

    # Cartes liquides
    "pokemon psa 10 alt art",
    "pokemon psa 10 charizard",
    "pokemon psa 10 pikachu",
    "pokemon sar psa 10",
    "pokemon japanese promo psa 10",

    # Topps / Panini / autres premium EN/FR
    "topps chrome hobby box",
    "topps chrome uefa hobby box",
    "topps finest uefa hobby box",
    "topps sapphire box",
    "topps chrome marvel box",
    "topps chrome star wars box",
    "topps chrome f1 hobby box",
    "topps chrome ufc hobby box",
    "panini prizm hobby box",
    "panini prizm blaster box",
    "panini select hobby box",
    "panini optic blaster box",
    "one piece booster box sealed",
    "lorcana booster box sealed"
]

BAD_WORDS = [
    "sticker", "stickers", "album", "empty", "wrapper", "digital",
    "proxy", "custom", "repack", "mystery", "random", "break",
    "case break", "live break", "opened", "damaged", "loose pack",
    "code card", "no cards", "empty box", "match attax", "adrenalyn",
    "hero attax", "german", "deutsch", "italian", "italiano", "spanish",
    "español", "espanol"
]

PREMIUM_WORDS = [
    "sealed", "scelle", "scellé", "booster box", "display",
    "elite trainer box", "etb", "pokemon center", "ultra premium",
    "premium collection", "japanese", "japan", "francais", "français",
    "english", "psa 10", "alt art", "sar", "promo", "charizard",
    "pikachu", "eevee heroes", "evolving skies", "151", "vstar universe",
    "vmax climax", "terastal festival", "shiny treasure", "blue sky stream",
    "dream league", "tag team", "chrome", "sapphire", "finest", "hobby",
    "prizm", "select", "optic", "one piece", "lorcana"
]

VERY_STRONG = [
    "eevee heroes", "evolving skies", "pokemon center", "blue sky stream",
    "dream league", "tag team", "vstar universe", "vmax climax",
    "terastal festival", "151", "psa 10", "alt art", "sar",
    "sealed lot", "stock", "liquidation", "chrome", "sapphire"
]

def send_telegram(message):
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": message[:3900],
        "disable_web_page_preview": False
    }
    r = requests.post(url, json=payload, timeout=20)
    print("Telegram:", r.status_code, r.text[:200])

def parse_price(text):
    if not text:
        return None
    cleaned = text.replace(",", ".")
    nums = re.findall(r"\d+(?:\.\d+)?", cleaned)
    if not nums:
        return None
    try:
        return float(nums[0])
    except:
        return None

def is_bad(title):
    t = title.lower()
    return any(bad in t for bad in BAD_WORDS)

def score_deal(title, price_text, query):
    text = f"{title} {price_text} {query}".lower()
    score = 35

    if is_bad(text):
        score -= 60

    for word in PREMIUM_WORDS:
        if word in text:
            score += 4

    for word in VERY_STRONG:
        if word in text:
            score += 8

    price = parse_price(price_text)

    if price:
        if "booster box" in text or "display" in text:
            if price < 80:
                score += 18
            elif price < 150:
                score += 10
            elif price > 600:
                score -= 8

        if "etb" in text or "elite trainer" in text:
            if price < 45:
                score += 15
            elif price < 80:
                score += 8

        if "psa 10" in text and price < 150:
            score += 10

        if "lot" in text or "collection" in text or "stock" in text:
            if price < 500:
                score += 10

    return max(0, min(100, score))

def verdict(score):
    if score >= 90:
        return "🔥 PRIORITÉ HAUTE — à vérifier immédiatement"
    if score >= 80:
        return "🟢 TRÈS INTÉRESSANT — comparaison marché nécessaire"
    if score >= 70:
        return "🟡 POTENTIEL — à analyser"
    return "⚪ DEBUG — calibrage"

def ebay_rss_url(query):
    return (
        "https://www.ebay.com/sch/i.html?"
        + "_nkw=" + requests.utils.quote(query)
        + "&_sop=10&LH_BIN=1&_rss=1"
    )

def search_ebay_rss(query):
    print("Searching RSS:", query)
    url = ebay_rss_url(query)
    headers = {"User-Agent": "Mozilla/5.0"}

    r = requests.get(url, headers=headers, timeout=25)
    print("RSS status:", r.status_code, "length:", len(r.text))

    if r.status_code != 200 or len(r.text) < 100:
        return []

    results = []

    try:
        root = ET.fromstring(r.text)
    except Exception as e:
        print("RSS parse error:", e)
        return []

    for item in root.findall(".//item")[:10]:
        title = item.findtext("title") or ""
        link = item.findtext("link") or ""
        description = item.findtext("description") or ""

        title = html.unescape(title).strip()
        link = html.unescape(link).split("?")[0]

        price_match = re.search(r"[\$€£CHF ]+\s?\d+(?:[.,]\d+)?", description)
        price = price_match.group(0).strip() if price_match else "Prix non extrait"

        if not title or is_bad(title):
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
    print("🚀 Deal Hunter AI started")
    print("Time:", datetime.utcnow().isoformat(), "UTC")

    all_results = []

    for query in SEARCHES:
        try:
            all_results.extend(search_ebay_rss(query))
        except Exception as e:
            print("Error:", query, e)

    unique = []
    seen = set()

    for deal in sorted(all_results, key=lambda x: x["score"], reverse=True):
        if deal["link"] in seen:
            continue
        seen.add(deal["link"])
        unique.append(deal)

    selected = unique[:MAX_RESULTS_TO_SEND]

    intro = f"""🔎 DEAL HUNTER AI — PASSAGE

Résultats uniques trouvés :
{len(unique)}

Résultats envoyés :
{len(selected)}

Sources :
eBay RSS

Langues ciblées :
Pokémon JP / EN / FR
Autres cartes EN / FR

Note :
Mode calibration. Les alertes ne sont pas encore des recommandations d'achat automatiques."""
    send_telegram(intro)

    if not selected:
        send_telegram("⚠️ Aucun résultat récupéré. Le flux RSS eBay est peut-être vide ou bloqué sur ce passage.")
        return

    for deal in selected:
        message = f"""🚨 DEAL HUNTER AI

Score :
{deal['score']}/100

Verdict :
{verdict(deal['score'])}

Produit :
{deal['title']}

Prix :
{deal['price']}

Recherche :
{deal['query']}

Plateforme :
eBay RSS

Lien :
{deal['link']}

Analyse :
Produit détecté par le radar. Ce n'est pas encore une validation d'achat.

À vérifier :
- ventes réalisées récentes
- prix livré Suisse
- langue / édition exacte
- scellage réel
- liquidité
- vendeur
- marge après frais"""
        send_telegram(message)

    print(f"✅ Sent {len(selected)} results")

if __name__ == "__main__":
    main()