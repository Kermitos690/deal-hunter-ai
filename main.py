import os
import re
import requests
from bs4 import BeautifulSoup
from datetime import datetime

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

# Approximation volontaire. Tu pourras la modifier plus tard ou la mettre en GitHub Secret.
USD_TO_CHF = float(os.getenv("USD_TO_CHF", "0.89"))

MAX_RESULTS_SENT = 10

CATALOG = [
    {
        "name": "Pokémon 151 JP Booster Box",
        "query": "pokemon japanese scarlet violet 151 booster box",
        "required": ["pokemon", "japanese", "151", "booster box"],
        "exclude": ["chinese", "korean", "surprise", "jumbo", "slim", "volume"],
        "swiss_range": (115, 145),
    },
    {
        "name": "Pokémon Eevee Heroes JP Booster Box",
        "query": "pokemon japanese eevee heroes booster box",
        "required": ["pokemon", "japanese", "eevee heroes", "booster box"],
        "exclude": ["korean", "chinese"],
        "swiss_range": (420, 550),
    },
    {
        "name": "Pokémon VSTAR Universe JP Booster Box",
        "query": "pokemon japanese vstar universe booster box",
        "required": ["pokemon", "japanese", "vstar universe", "booster box"],
        "exclude": ["korean", "chinese"],
        "swiss_range": (95, 130),
    },
    {
        "name": "Pokémon VMAX Climax JP Booster Box",
        "query": "pokemon japanese vmax climax booster box",
        "required": ["pokemon", "japanese", "vmax climax", "booster box"],
        "exclude": ["korean", "chinese", "time warp", "subscribe"],
        "swiss_range": (130, 180),
    },
    {
        "name": "Pokémon Terastal Festival JP Booster Box",
        "query": "pokemon japanese terastal festival booster box",
        "required": ["pokemon", "japanese", "terastal festival", "booster box"],
        "exclude": ["korean", "chinese"],
        "swiss_range": (85, 120),
    },
    {
        "name": "Pokémon Evolving Skies EN Booster Box",
        "query": "pokemon evolving skies booster box",
        "required": ["pokemon", "evolving skies", "booster box"],
        "exclude": ["half booster", "korean", "chinese", "german", "italian", "spanish"],
        "swiss_range": (650, 850),
    },
    {
        "name": "Pokémon Blue Sky Stream JP Booster Box",
        "query": "pokemon japanese blue sky stream booster box",
        "required": ["pokemon", "japanese", "blue sky stream", "booster box"],
        "exclude": ["korean", "chinese"],
        "swiss_range": (130, 190),
    },
    {
        "name": "Pokémon Dream League JP Booster Box",
        "query": "pokemon japanese dream league booster box",
        "required": ["pokemon", "japanese", "dream league", "booster box"],
        "exclude": ["korean", "chinese"],
        "swiss_range": (230, 330),
    },
    {
        "name": "Pokémon Shiny Treasure ex JP Booster Box",
        "query": "pokemon japanese shiny treasure ex booster box",
        "required": ["pokemon", "japanese", "shiny treasure", "booster box"],
        "exclude": ["korean", "chinese"],
        "swiss_range": (65, 95),
    },
    {
        "name": "Topps Chrome UEFA Hobby Box",
        "query": "topps chrome uefa hobby box",
        "required": ["topps", "chrome", "hobby box"],
        "any_of": ["uefa", "ucl", "champions"],
        "exclude": ["disney", "marvel", "star wars", "baseball", "formula", "f1"],
        "swiss_range": (90, 150),
    },
    {
        "name": "Panini Prizm Hobby Box",
        "query": "panini prizm hobby box",
        "required": ["panini", "prizm", "hobby box"],
        "exclude": ["sticker", "album", "adrenalyn"],
        "swiss_range": (90, 180),
    },
    {
        "name": "One Piece Booster Box",
        "query": "one piece booster box",
        "required": ["one piece", "booster box"],
        "exclude": ["korean", "chinese", "japanese version proxy"],
        "swiss_range": (90, 150),
    },
    {
        "name": "Lorcana Booster Box",
        "query": "lorcana booster box",
        "required": ["lorcana", "booster box"],
        "exclude": ["german", "italian", "spanish"],
        "swiss_range": (90, 140),
    },
]

GLOBAL_EXCLUDE = [
    "chinese",
    "korean",
    "thai",
    "indonesian",
    "german",
    "italian",
    "spanish",
    "portuguese",
    "proxy",
    "fake",
    "custom",
    "orica",
    "repack",
    "digital",
    "empty",
    "wrapper",
    "pricecharting-pro",
    "subscribe",
    "time warp",
]


def send_telegram(message: str):
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        print("Telegram secrets missing.")
        print(message)
        return

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": message[:3900],
        "disable_web_page_preview": False,
    }

    try:
        r = requests.post(url, json=payload, timeout=20)
        print("Telegram:", r.status_code, r.text[:150])
    except Exception as e:
        print("Telegram error:", e)


def normalize(text: str) -> str:
    return " ".join(text.lower().replace("&", "and").split())


def contains_all(text: str, words: list[str]) -> bool:
    low = normalize(text)
    return all(normalize(w) in low for w in words)


def contains_any(text: str, words: list[str]) -> bool:
    low = normalize(text)
    return any(normalize(w) in low for w in words)


def is_excluded(text: str, extra_exclude: list[str]) -> bool:
    low = normalize(text)
    banned = GLOBAL_EXCLUDE + extra_exclude
    return any(normalize(word) in low for word in banned)


def extract_price_strings(text: str) -> list[str]:
    # Corrige les prix du type $2,475.00, $1,700.00, $845.02
    return re.findall(r"\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?", text)


def price_to_float(price: str) -> float:
    return float(price.replace("$", "").replace(",", ""))


def clean_product_text(text: str) -> str:
    text = re.sub(r"\+ Collection In One Click.*", "", text)
    text = re.sub(r"\+ Wishlist.*", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:260]


def market_status(price_chf: float, swiss_range):
    if not swiss_range:
        return "Marché suisse non calibré"

    low, high = swiss_range

    if price_chf < low:
        return "PriceCharting inférieur au marché suisse estimé"
    if low <= price_chf <= high:
        return "Cohérent avec le marché suisse estimé"
    return "PriceCharting supérieur au marché suisse estimé"


def score_reference(product_name: str, price_chf: float, swiss_range) -> int:
    score = 50
    low_text = normalize(product_name)

    premium_terms = [
        "151",
        "eevee heroes",
        "evolving skies",
        "vstar universe",
        "vmax climax",
        "terastal festival",
        "blue sky stream",
        "dream league",
        "topps chrome",
        "panini prizm",
        "one piece",
        "lorcana",
    ]

    for term in premium_terms:
        if term in low_text:
            score += 6

    if swiss_range:
        low, high = swiss_range
        if low <= price_chf <= high:
            score += 10
        elif price_chf < low:
            score += 15
        else:
            score -= 5

    return max(0, min(100, score))


def verdict_reference(score: int) -> str:
    if score >= 85:
        return "🟢 Référence prioritaire"
    if score >= 70:
        return "🟡 Référence utile"
    return "⚪ Référence marché"


def matches_catalog(row_text: str, config: dict) -> bool:
    if is_excluded(row_text, config.get("exclude", [])):
        return False

    if not contains_all(row_text, config["required"]):
        return False

    any_of = config.get("any_of")
    if any_of and not contains_any(row_text, any_of):
        return False

    return True


def pricecharting_search(config: dict):
    url = "https://www.pricecharting.com/search-products"
    params = {"q": config["query"], "type": "prices"}

    r = requests.get(
        url,
        params=params,
        headers={"User-Agent": "Mozilla/5.0"},
        timeout=30,
    )

    soup = BeautifulSoup(r.text, "html.parser")
    results = []
    seen_links = set()

    for row in soup.select("tr")[:50]:
        raw_text = row.get_text(" ", strip=True)

        if not raw_text:
            continue

        if not matches_catalog(raw_text, config):
            continue

        link_el = row.select_one("a")
        if not link_el:
            continue

        href = link_el.get("href", "")
        link = href if href.startswith("http") else "https://www.pricecharting.com" + href

        if link in seen_links:
            continue

        prices = extract_price_strings(raw_text)
        if not prices:
            continue

        seen_links.add(link)

        product_text = clean_product_text(raw_text)
        main_usd = price_to_float(prices[0])
        main_chf = round(main_usd * USD_TO_CHF, 2)

        score = score_reference(product_text, main_chf, config.get("swiss_range"))

        results.append({
            "catalog_name": config["name"],
            "query": config["query"],
            "product": product_text,
            "url": link,
            "prices": prices[:3],
            "main_usd": main_usd,
            "main_chf": main_chf,
            "swiss_range": config.get("swiss_range"),
            "score": score,
            "status": market_status(main_chf, config.get("swiss_range")),
        })

    return results[:1]


def main():
    all_results = []
    errors = []

    for config in CATALOG:
        try:
            found = pricecharting_search(config)
            all_results.extend(found)
        except Exception as e:
            errors.append(f"{config['name']} : {e}")

    all_results = sorted(all_results, key=lambda x: x["score"], reverse=True)

    send_telegram(f"""🔎 DEAL HUNTER AI — MARKET ENGINE V4

Statut :
Fonctionnel comme moteur de référence marché.

Source :
PriceCharting

Important :
Ce module ne cherche PAS encore des annonces disponibles.
Il sert à construire la base de comparaison.

Produits surveillés :
{len(CATALOG)}

Références propres trouvées :
{len(all_results)}

Erreurs :
{len(errors)}

Conversion utilisée :
1 USD = {USD_TO_CHF} CHF

Heure :
{datetime.utcnow().isoformat()} UTC
""")

    if errors:
        send_telegram("⚠️ Erreurs détectées\n\n" + "\n".join(errors[:10]))

    if not all_results:
        send_telegram("⚠️ Aucune référence propre trouvée sur ce passage.")
        return

    for item in all_results[:MAX_RESULTS_SENT]:
        swiss = item["swiss_range"]
        swiss_text = f"{swiss[0]}–{swiss[1]} CHF" if swiss else "Non calibré"

        send_telegram(f"""📊 DEAL HUNTER AI — RÉFÉRENCE PROPRE

Produit surveillé :
{item['catalog_name']}

Score référence :
{item['score']}/100

Verdict :
{verdict_reference(item['score'])}

Produit PriceCharting :
{item['product']}

Prix PriceCharting :
{", ".join(item['prices'])}

Prix principal estimé :
{item['main_usd']} USD
≈ {item['main_chf']} CHF

Marché suisse estimé :
{swiss_text}

Lecture :
{item['status']}

Lien :
{item['url']}

Rappel :
Ce n'est pas encore une annonce d'achat.
Cette donnée sert de référence pour comparer les futures annonces actives.
""")


if __name__ == "__main__":
    main()