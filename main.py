import os, re, requests
from bs4 import BeautifulSoup
from datetime import datetime

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

# Mode test : envoie toujours les meilleurs résultats trouvés
DEBUG_SEND_TOP_RESULTS = True
MIN_SCORE_ALERT = 70
MAX_ALERTS = 8

SEARCHES = [
    # Pokémon scellé international
    "pokemon sealed booster box",
    "pokemon sealed display",
    "pokemon elite trainer box sealed",
    "pokemon center elite trainer box",
    "pokemon ultra premium collection sealed",
    "pokemon premium collection sealed",
    "pokemon booster bundle sealed",
    "pokemon collection box sealed",

    # Japonais / High Class / séries recherchées
    "pokemon japanese booster box sealed",
    "pokemon japan booster box sealed",
    "pokemon high class pack sealed",
    "pokemon vstar universe booster box",
    "pokemon vmax climax booster box",
    "pokemon shiny star v booster box",
    "pokemon shiny treasure ex booster box",
    "pokemon terastal festival booster box",
    "pokemon battle partners booster box",
    "pokemon 151 japanese booster box",
    "pokemon eevee heroes booster box",
    "pokemon blue sky stream booster box",
    "pokemon dream league booster box",
    "pokemon tag team gx booster box",
    "pokemon clay burst booster box",
    "pokemon ruler of the black flame booster box",

    # Anglais / grosses séries
    "pokemon evolving skies booster box sealed",
    "pokemon fusion strike booster box sealed",
    "pokemon chilling reign booster box sealed",
    "pokemon brilliant stars booster box sealed",
    "pokemon lost origin booster box sealed",
    "pokemon silver tempest booster box sealed",
    "pokemon scarlet violet booster box sealed",
    "pokemon paldea evolved booster box sealed",
    "pokemon obsidian flames booster box sealed",
    "pokemon paradox rift booster box sealed",
    "pokemon temporal forces booster box sealed",
    "pokemon twilight masquerade booster box sealed",
    "pokemon surging sparks booster box sealed",
    "pokemon prismatic evolutions sealed",

    # Lots / liquidation
    "pokemon sealed collection lot",
    "pokemon sealed product lot",
    "pokemon store stock sealed",
    "pokemon liquidation sealed",
    "pokemon bulk sealed boxes",

    # Cartes très liquides uniquement
    "pokemon psa 10 alt art",
    "pokemon psa 10 charizard",
    "pokemon psa 10 pikachu promo",
    "pokemon sar psa 10",
    "pokemon japanese promo psa 10",
]

BAD_WORDS = [
    "sticker", "stickers", "album", "empty", "wrapper", "digital",
    "proxy", "custom", "repack", "mystery", "random", "break",
    "case break", "live break", "opened", "damaged", "loose pack",
    "code card", "jumbo only", "empty box", "no cards", "bundle only",
    "art set only", "pack fresh", "read description"
]

PREMIUM_WORDS = [
    "sealed", "factory sealed", "booster box", "display", "elite trainer box",
    "etb", "pokemon center", "ultra premium", "upc", "premium collection",
    "booster bundle", "japanese", "japan", "high class", "psa 10",
    "alt art", "sar", "promo", "charizard", "pikachu", "eevee heroes",
    "evolving skies", "151", "vstar universe", "vmax climax",
    "terastal festival", "shiny treasure", "blue sky stream",
    "dream league", "tag team", "sealed lot", "store stock", "liquidation"
]

VERY_STRONG = [
    "eevee heroes", "evolving skies", "pokemon center", "151 japanese",
    "vstar universe", "vmax climax", "dream league", "blue sky stream",
    "tag team", "psa 10", "alt art", "sar", "sealed lot", "liquidation"
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

def clean_url(url):
    m = re.search(r"https://www\.ebay\.[^/]+/itm/\d+", url)
    return m.group(0) if m else url.split("?")[0]

def parse_price(price_text):
    if not price_text:
        return None
    cleaned = price_text.replace(",", ".")
    nums = re.findall(r"\d+(?:\.\d+)?", cleaned)
    if not nums:
        return None
    try:
        return float(nums[0])
    except:
        return None

def score_deal(title, price_text, query):
    text = f"{title} {price_text} {query}".lower()
    score = 35

    for bad in BAD_WORDS:
        if bad in text:
            score -= 45

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
            elif price < 140:
                score += 10
            elif price > 500:
                score -= 8

        if "elite trainer" in text or "etb" in text:
            if price < 45:
                score += 15
            elif price < 70:
                score += 8

        if "psa 10" in text:
            if price < 100:
                score += 12
            elif price > 800:
                score -= 10

        if "lot" in text or "collection" in text or "stock" in text:
            if price < 500:
                score += 10

    if "sealed" in text:
        score += 10
    if "japanese" in text or "japan" in text:
        score += 8
    if "pokemon center" in text:
        score += 12
    if "booster box" in text:
        score += 12
    if "psa 10" in text:
        score += 8

    return max(0, min(100, score))

def verdict(score):
    if score >= 90:
        return "🔥 PRIORITÉ HAUTE — à vérifier immédiatement"
    if score >= 80:
        return "🟢 TRÈS INTÉRESSANT — comparaison marché nécessaire"
    if score >= 70:
        return "🟡 POTENTIEL — à analyser"
    return "⚪ DEBUG — résultat utile pour calibrage"

def search_ebay(query):
    url = "https://www.ebay.com/sch/i.html"
    params = {"_nkw": query, "_sop": "10", "LH_BIN": "1"}
    headers = {"User-Agent": "Mozilla/5.0"}

    print(f"Searching eBay: {query}")
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
    print("🚀 Deal Hunter AI started")
    print("Time:", datetime.utcnow().isoformat(), "UTC")

    all_results = []

    for query in SEARCHES:
        try:
            all_results.extend(search_ebay(query))
        except Exception as e:
            print("Error:", query, e)

    seen = set()
    unique = []

    for d in sorted(all_results, key=lambda x: x["score"], reverse=True):
        if d["link"] in seen:
            continue
        seen.add(d["link"])
        unique.append(d)

    if DEBUG_SEND_TOP_RESULTS:
        selected = unique[:MAX_ALERTS]
    else:
        selected = [d for d in unique if d["score"] >= MIN_SCORE_ALERT][:MAX_ALERTS]

    if not selected:
        send_telegram("✅ Deal Hunter AI lancé.\n\nAucun résultat exploitable détecté sur ce passage.")
        print("No results.")
        return

    intro = f"""🔎 DEAL HUNTER AI — PASSAGE POKÉMON

Résultats analysés : {len(unique)}
Alertes envoyées : {len(selected)}
Mode : {"DEBUG TOP RESULTS" if DEBUG_SEND_TOP_RESULTS else "ALERTES FILTRÉES"}

Objectif :
Calibration du radar Pokémon global : japonais, anglais, scellé, lots, PSA 10, produits premium."""
    send_telegram(intro)

    for deal in selected:
        message = f"""🚨 DEAL HUNTER AI

Score : {deal['score']}/100
Verdict : {verdict(deal['score'])}

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
Détection Pokémon large. Ce score ne prouve pas encore que c'est sous-coté : il indique que le produit mérite une comparaison marché.

À vérifier avant achat :
- ventes réalisées récentes
- prix livré Suisse
- langue / édition exacte
- scellage réel
- réputation vendeur
- liquidité du produit
- marge après frais

Décision :
Ne pas acheter automatiquement. Utiliser cette alerte pour calibrer le moteur."""
        send_telegram(message)

    print(f"✅ Sent {len(selected)} alerts")

if __name__ == "__main__":
    main()