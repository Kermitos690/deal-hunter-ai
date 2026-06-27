import os
import re
import json
import base64
import imaplib
import email
from email.header import decode_header
from datetime import datetime
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

# =========================
# SECRETS / CONFIGURATION
# =========================

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

SERPAPI_API_KEY = os.getenv("SERPAPI_API_KEY")

EBAY_CLIENT_ID = os.getenv("EBAY_CLIENT_ID")
EBAY_CLIENT_SECRET = os.getenv("EBAY_CLIENT_SECRET")
EBAY_MARKETPLACES = [x.strip() for x in os.getenv("EBAY_MARKETPLACES", "EBAY_CH,EBAY_US,EBAY_GB").split(",") if x.strip()]

EMAIL_IMAP_SERVER = os.getenv("EMAIL_IMAP_SERVER") or os.getenv("DEAL_IMAP_SERVER")
EMAIL_ADDRESS = os.getenv("EMAIL_ADDRESS") or os.getenv("DEAL_EMAIL_ADDRESS")
EMAIL_APP_PASSWORD = os.getenv("EMAIL_APP_PASSWORD") or os.getenv("DEAL_EMAIL_APP_PASSWORD")

USD_TO_CHF = float(os.getenv("USD_TO_CHF", "0.89"))
EUR_TO_CHF = float(os.getenv("EUR_TO_CHF", "0.96"))
GBP_TO_CHF = float(os.getenv("GBP_TO_CHF", "1.13"))
JPY_TO_CHF = float(os.getenv("JPY_TO_CHF", "0.0058"))

MAX_REFERENCE_MESSAGES = int(os.getenv("MAX_REFERENCE_MESSAGES", "8"))
MAX_DEAL_MESSAGES = int(os.getenv("MAX_DEAL_MESSAGES", "12"))
DEAL_ALERT_MIN_SCORE = int(os.getenv("DEAL_ALERT_MIN_SCORE", "55"))

SELLING_FEE_RATE = float(os.getenv("SELLING_FEE_RATE", "0.13"))
EXPORT_SHIPPING_BUFFER_CHF = float(os.getenv("EXPORT_SHIPPING_BUFFER_CHF", "25"))
IMPORT_SHIPPING_BUFFER_CHF = float(os.getenv("IMPORT_SHIPPING_BUFFER_CHF", "22"))
IMPORT_DUTY_BUFFER_CHF = float(os.getenv("IMPORT_DUTY_BUFFER_CHF", "10"))
MIN_PROFIT_CHF = float(os.getenv("MIN_PROFIT_CHF", "30"))

# SerpApi peut coûter des crédits. Par défaut, on cherche surtout en Suisse.
# Pour élargir : GitHub Secret SERPAPI_COUNTRIES=ch,fr,de,uk,us
SERPAPI_COUNTRIES = [x.strip().lower() for x in os.getenv("SERPAPI_COUNTRIES", "ch").split(",") if x.strip()]

SHOPPING_COUNTRY_CONFIG = {
    "ch": {"gl": "ch", "hl": "fr", "google_domain": "google.ch", "location": "Switzerland", "country": "CH"},
    "fr": {"gl": "fr", "hl": "fr", "google_domain": "google.fr", "location": "France", "country": "FR"},
    "de": {"gl": "de", "hl": "de", "google_domain": "google.de", "location": "Germany", "country": "DE"},
    "uk": {"gl": "uk", "hl": "en", "google_domain": "google.co.uk", "location": "United Kingdom", "country": "GB"},
    "gb": {"gl": "uk", "hl": "en", "google_domain": "google.co.uk", "location": "United Kingdom", "country": "GB"},
    "us": {"gl": "us", "hl": "en", "google_domain": "google.com", "location": "United States", "country": "US"},
}

# =========================
# CATALOGUE PRODUITS
# =========================

CATALOG = [
    {
        "name": "Pokémon 151 JP Booster Box",
        "query": "pokemon japanese scarlet violet 151 booster box",
        "shopping_query": "Pokemon Japanese Scarlet Violet 151 booster box display sealed",
        "required": ["pokemon", "japanese", "151", "booster box"],
        "exclude": ["chinese", "korean", "surprise", "jumbo", "slim", "volume", "mini tin", "poster", "binder"],
        "swiss_range": (115, 145),
    },
    {
        "name": "Pokémon Eevee Heroes JP Booster Box",
        "query": "pokemon japanese eevee heroes booster box",
        "shopping_query": "Pokemon Japanese Eevee Heroes booster box display sealed",
        "required": ["pokemon", "japanese", "eevee heroes", "booster box"],
        "exclude": ["korean", "chinese", "single pack"],
        "swiss_range": (420, 550),
    },
    {
        "name": "Pokémon VSTAR Universe JP Booster Box",
        "query": "pokemon japanese vstar universe booster box",
        "shopping_query": "Pokemon Japanese VSTAR Universe booster box display sealed",
        "required": ["pokemon", "japanese", "vstar universe", "booster box"],
        "exclude": ["korean", "chinese", "single pack"],
        "swiss_range": (95, 130),
    },
    {
        "name": "Pokémon VMAX Climax JP Booster Box",
        "query": "pokemon japanese vmax climax booster box",
        "shopping_query": "Pokemon Japanese VMAX Climax booster box display sealed",
        "required": ["pokemon", "japanese", "vmax climax", "booster box"],
        "exclude": ["korean", "chinese", "time warp", "subscribe", "single pack"],
        "swiss_range": (130, 180),
    },
    {
        "name": "Pokémon Terastal Festival JP Booster Box",
        "query": "pokemon japanese terastal festival booster box",
        "shopping_query": "Pokemon Japanese Terastal Festival booster box display sealed",
        "required": ["pokemon", "japanese", "terastal festival", "booster box"],
        "exclude": ["korean", "chinese", "single pack"],
        "swiss_range": (85, 120),
    },
    {
        "name": "Pokémon Evolving Skies EN Booster Box",
        "query": "pokemon evolving skies booster box",
        "shopping_query": "Pokemon Evolving Skies booster box sealed",
        "required": ["pokemon", "evolving skies", "booster box"],
        "exclude": ["half booster", "korean", "chinese", "german", "italian", "spanish", "single pack"],
        "swiss_range": (650, 850),
    },
    {
        "name": "Pokémon Blue Sky Stream JP Booster Box",
        "query": "pokemon japanese blue sky stream booster box",
        "shopping_query": "Pokemon Japanese Blue Sky Stream booster box display sealed",
        "required": ["pokemon", "japanese", "blue sky stream", "booster box"],
        "exclude": ["korean", "chinese", "single pack"],
        "swiss_range": (130, 190),
    },
    {
        "name": "Pokémon Dream League JP Booster Box",
        "query": "pokemon japanese dream league booster box",
        "shopping_query": "Pokemon Japanese Dream League booster box display sealed",
        "required": ["pokemon", "japanese", "dream league", "booster box"],
        "exclude": ["korean", "chinese", "single pack"],
        "swiss_range": (230, 330),
    },
    {
        "name": "Pokémon Shiny Treasure ex JP Booster Box",
        "query": "pokemon japanese shiny treasure ex booster box",
        "shopping_query": "Pokemon Japanese Shiny Treasure ex booster box display sealed",
        "required": ["pokemon", "japanese", "shiny treasure", "booster box"],
        "exclude": ["korean", "chinese", "single pack"],
        "swiss_range": (65, 95),
    },
    {
        "name": "Topps Chrome UEFA Hobby Box",
        "query": "topps chrome uefa hobby box",
        "shopping_query": "Topps Chrome UEFA hobby box sealed",
        "required": ["topps", "chrome", "hobby box"],
        "any_of": ["uefa", "ucl", "champions"],
        "exclude": ["disney", "marvel", "star wars", "baseball", "formula", "f1"],
        "swiss_range": (90, 150),
    },
    {
        "name": "Panini Prizm Hobby Box",
        "query": "panini prizm hobby box",
        "shopping_query": "Panini Prizm hobby box sealed",
        "required": ["panini", "prizm", "hobby box"],
        "exclude": ["sticker", "album", "adrenalyn", "blaster", "mega box"],
        "swiss_range": (90, 180),
    },
    {
        "name": "One Piece Booster Box",
        "query": "one piece booster box",
        "shopping_query": "One Piece card game booster box sealed",
        "required": ["one piece", "booster box"],
        "exclude": ["korean", "chinese", "proxy", "single pack"],
        "swiss_range": (90, 150),
    },
    {
        "name": "Lorcana Booster Box",
        "query": "lorcana booster box",
        "shopping_query": "Disney Lorcana booster box sealed display",
        "required": ["lorcana", "booster box"],
        "exclude": ["german", "italian", "spanish", "single pack"],
        "swiss_range": (90, 140),
    },
]

GLOBAL_EXCLUDE = [
    "chinese", "korean", "thai", "indonesian", "german", "italian", "spanish", "portuguese",
    "proxy", "fake", "custom", "orica", "repack", "digital", "empty", "wrapper",
    "pricecharting-pro", "subscribe", "time warp", "playmat", "sleeves", "deck box",
]

# =========================
# OUTILS DE BASE
# =========================

def send_telegram(message: str):
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        print("Telegram secrets missing.")
        print(message)
        return

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {"chat_id": TELEGRAM_CHAT_ID, "text": message[:3900], "disable_web_page_preview": False}

    try:
        r = requests.post(url, json=payload, timeout=20)
        print("Telegram:", r.status_code, r.text[:150])
    except Exception as e:
        print("Telegram error:", e)


def normalize(text: str) -> str:
    low = str(text or "").lower()
    replacements = {
        "&": " and ",
        "é": "e", "è": "e", "ê": "e", "ë": "e",
        "à": "a", "â": "a",
        "î": "i", "ï": "i",
        "ô": "o", "ö": "o",
        "ù": "u", "û": "u", "ü": "u",
        "ç": "c",
        "japonais": "japanese", "japonaise": "japanese", "japon": "japanese",
        "jp": "japanese", "jpn": "japanese", "japan": "japanese",
        "boite": "box", "boîte": "box",
        "display": "booster box", "booster display": "booster box",
        "hobby display": "hobby box",
        "sealed": "sealed",
    }
    for a, b in replacements.items():
        low = low.replace(a, b)
    low = re.sub(r"[^a-z0-9$€£¥.%,:/?=&+\- ]+", " ", low)
    low = re.sub(r"\s+", " ", low).strip()
    return low


def keyword_present(text: str, keyword: str) -> bool:
    low = normalize(text)
    key = normalize(keyword)

    if key == "booster box":
        return any(x in low for x in ["booster box", "box booster", "booster display", "display booster", "display", "box"])

    if key == "hobby box":
        return any(x in low for x in ["hobby box", "hobby display", "box hobby"])

    if key == "japanese":
        return any(x in low for x in ["japanese", "japan", "japon", "japonais", "japanese"])

    return key in low


def contains_all(text: str, words: list[str]) -> bool:
    return all(keyword_present(text, word) for word in words)


def contains_any(text: str, words: list[str]) -> bool:
    return any(keyword_present(text, word) for word in words)


def is_excluded(text: str, extra_exclude: list[str] | None = None) -> bool:
    low = normalize(text)
    banned = GLOBAL_EXCLUDE + (extra_exclude or [])
    return any(normalize(word) in low for word in banned)


def matches_catalog(text: str, config: dict) -> bool:
    if is_excluded(text, config.get("exclude", [])):
        return False
    if not contains_all(text, config["required"]):
        return False
    any_of = config.get("any_of")
    if any_of and not contains_any(text, any_of):
        return False
    return True


def extract_price_strings_usd(text: str) -> list[str]:
    return re.findall(r"\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?", str(text))


def price_to_float(price: str) -> float:
    return float(str(price).replace("$", "").replace("€", "").replace("£", "").replace("CHF", "").replace("USD", "").replace("EUR", "").replace("GBP", "").replace(",", "").strip())


def currency_to_chf(amount: float, currency: str) -> float | None:
    cur = (currency or "").upper().strip()
    if cur in ["CHF", "SFR", "FR", "FR."]:
        return round(amount, 2)
    if cur in ["USD", "$"]:
        return round(amount * USD_TO_CHF, 2)
    if cur in ["EUR", "€"]:
        return round(amount * EUR_TO_CHF, 2)
    if cur in ["GBP", "£"]:
        return round(amount * GBP_TO_CHF, 2)
    if cur in ["JPY", "¥"]:
        return round(amount * JPY_TO_CHF, 2)
    return None


def parse_price_to_chf(price_text: str | None, extracted_price=None, currency_hint: str | None = None) -> tuple[float | None, str]:
    text = str(price_text or "")

    if currency_hint and extracted_price is not None:
        try:
            chf = currency_to_chf(float(extracted_price), currency_hint)
            if chf is not None:
                return chf, currency_hint.upper()
        except Exception:
            pass

    patterns = [
        (r"(?:CHF|SFr\.?|Fr\.?)\s*([0-9]+(?:[.,][0-9]{2})?)", "CHF"),
        (r"([0-9]+(?:[.,][0-9]{2})?)\s*(?:CHF|SFr\.?|Fr\.?)", "CHF"),
        (r"€\s*([0-9]+(?:[.,][0-9]{2})?)", "EUR"),
        (r"([0-9]+(?:[.,][0-9]{2})?)\s*€", "EUR"),
        (r"\$\s*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{2})?)", "USD"),
        (r"£\s*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{2})?)", "GBP"),
        (r"¥\s*([0-9]+(?:,[0-9]{3})*)", "JPY"),
    ]

    for pattern, cur in patterns:
        m = re.search(pattern, text, flags=re.I)
        if m:
            raw = m.group(1).replace("'", "").replace(" ", "")
            if cur in ["USD", "GBP", "JPY"]:
                raw = raw.replace(",", "")
            else:
                raw = raw.replace(",", ".")
            try:
                amount = float(raw)
                chf = currency_to_chf(amount, cur)
                return chf, cur
            except Exception:
                continue

    if extracted_price is not None:
        try:
            amount = float(extracted_price)
            return round(amount, 2), "CHF?"
        except Exception:
            pass

    return None, "UNKNOWN"


def clean_product_text(text: str) -> str:
    text = re.sub(r"\+ Collection In One Click.*", "", str(text))
    text = re.sub(r"\+ Wishlist.*", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:280]


def domain_from_url(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return ""

# =========================
# PRICECHARTING = RÉFÉRENCE
# =========================

def analyse_pricecharting_product_page(url: str) -> dict:
    data = {
        "availability": "Non confirmé",
        "sales_count_signal": 0,
        "liquidity": "Inconnue",
        "buy_links": [],
    }

    try:
        r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
        soup = BeautifulSoup(r.text, "html.parser")
        page_text = soup.get_text(" ", strip=True)
        low = normalize(page_text)

        if "sorry none available" in low:
            data["availability"] = "Aucune annonce directe visible sur PriceCharting"
        elif "compare prices" in low or "buy" in low or "sell" in low:
            data["availability"] = "Liens externes possibles, disponibilité à vérifier"
        else:
            data["availability"] = "Disponibilité non confirmée"

        sale_dates = re.findall(r"20\d{2}-\d{2}-\d{2}", page_text)
        ebay_mentions = low.count("ebay")
        data["sales_count_signal"] = max(len(sale_dates), min(ebay_mentions, 99))

        if data["sales_count_signal"] >= 15:
            data["liquidity"] = "Forte"
        elif data["sales_count_signal"] >= 5:
            data["liquidity"] = "Moyenne"
        elif data["sales_count_signal"] >= 1:
            data["liquidity"] = "Faible"
        else:
            data["liquidity"] = "Inconnue"

        buy_links = []
        for a in soup.select("a[href]"):
            href = a.get("href", "")
            label = a.get_text(" ", strip=True).lower()
            href_low = href.lower()
            useful = any(x in href_low for x in ["ebay", "tcgplayer", "cardmarket"]) or ("buy" in label and "pricecharting" in href_low)
            blocked = any(x in href_low for x in ["pricecharting-pro", "salesphotos", "wishlist"])
            if useful and not blocked:
                full = href if href.startswith("http") else "https://www.pricecharting.com" + href
                if full not in buy_links:
                    buy_links.append(full)
        data["buy_links"] = buy_links[:3]

    except Exception as e:
        data["availability"] = f"Non confirmé ({type(e).__name__})"

    return data


def compute_reference_score(liquidity: str, main_chf: float, swiss_range: tuple[int, int] | None) -> int:
    score = 45
    if liquidity == "Forte":
        score += 18
    elif liquidity == "Moyenne":
        score += 10
    elif liquidity == "Faible":
        score += 4

    if swiss_range:
        low, high = swiss_range
        if main_chf > high:
            score += 8
        elif low <= main_chf <= high:
            score += 5
        elif main_chf < low:
            score += 3

    return max(0, min(100, score))


def pricecharting_search(config: dict) -> list[dict]:
    url = "https://www.pricecharting.com/search-products"
    params = {"q": config["query"], "type": "prices"}

    r = requests.get(url, params=params, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
    if r.status_code != 200:
        raise Exception(f"PriceCharting status {r.status_code}")

    soup = BeautifulSoup(r.text, "html.parser")
    results = []
    seen_links = set()

    for row in soup.select("tr")[:50]:
        raw_text = row.get_text(" ", strip=True)
        if not raw_text or not matches_catalog(raw_text, config):
            continue

        link_el = row.select_one("a")
        if not link_el:
            continue

        href = link_el.get("href", "")
        link = href if href.startswith("http") else "https://www.pricecharting.com" + href
        if link in seen_links:
            continue

        prices = extract_price_strings_usd(raw_text)
        if not prices:
            continue

        seen_links.add(link)
        product_text = clean_product_text(raw_text)
        main_usd = price_to_float(prices[0])
        main_chf = round(main_usd * USD_TO_CHF, 2)

        page = analyse_pricecharting_product_page(link)
        score = compute_reference_score(page["liquidity"], main_chf, config.get("swiss_range"))

        results.append({
            "catalog_name": config["name"],
            "query": config["query"],
            "product": product_text,
            "url": link,
            "prices": prices[:3],
            "main_usd": main_usd,
            "main_chf": main_chf,
            "swiss_range": config.get("swiss_range"),
            "availability": page["availability"],
            "sales_count_signal": page["sales_count_signal"],
            "liquidity": page["liquidity"],
            "buy_links": page["buy_links"],
            "score": score,
        })

    return results[:1]

# =========================
# OFFRES GOOGLE SHOPPING VIA SERPAPI
# =========================

def serpapi_google_shopping_offers(config: dict) -> list[dict]:
    if not SERPAPI_API_KEY:
        return []

    offers = []
    query = config.get("shopping_query") or config["query"]

    for country_key in SERPAPI_COUNTRIES:
        country_cfg = SHOPPING_COUNTRY_CONFIG.get(country_key)
        if not country_cfg:
            continue

        params = {
            "engine": "google_shopping",
            "q": query,
            "api_key": SERPAPI_API_KEY,
            "gl": country_cfg["gl"],
            "hl": country_cfg["hl"],
            "google_domain": country_cfg["google_domain"],
            "location": country_cfg["location"],
            "num": "10",
        }

        try:
            r = requests.get("https://serpapi.com/search.json", params=params, timeout=40)
            data = r.json()
            shopping_results = data.get("shopping_results", []) or []

            for item in shopping_results[:10]:
                title = item.get("title", "")
                if not title or not matches_catalog(title, config):
                    continue

                link = item.get("link") or item.get("product_link") or item.get("serpapi_product_api") or ""
                if not link:
                    continue

                price_text = item.get("price") or ""
                extracted = item.get("extracted_price")
                price_chf, currency = parse_price_to_chf(price_text, extracted_price=extracted)
                if price_chf is None or price_chf <= 0:
                    continue

                source = item.get("source") or domain_from_url(link) or "Google Shopping"
                delivery = item.get("delivery") or item.get("shipping") or ""

                offers.append({
                    "title": clean_product_text(title),
                    "price_chf": price_chf,
                    "currency": currency,
                    "source": f"Google Shopping / {source}",
                    "platform": source,
                    "country": country_cfg["country"],
                    "url": link,
                    "raw_price": price_text,
                    "delivery": delivery,
                    "catalog_name": config["name"],
                    "is_active": True,
                })
        except Exception as e:
            print("SerpApi error:", config["name"], country_key, e)

    return offers

# =========================
# EBAY API OFFICIELLE, OPTIONNELLE
# =========================

def ebay_get_token() -> str | None:
    if not EBAY_CLIENT_ID or not EBAY_CLIENT_SECRET:
        return None

    try:
        credentials = f"{EBAY_CLIENT_ID}:{EBAY_CLIENT_SECRET}".encode()
        encoded = base64.b64encode(credentials).decode()
        headers = {
            "Authorization": f"Basic {encoded}",
            "Content-Type": "application/x-www-form-urlencoded",
        }
        data = {
            "grant_type": "client_credentials",
            "scope": "https://api.ebay.com/oauth/api_scope",
        }
        r = requests.post("https://api.ebay.com/identity/v1/oauth2/token", headers=headers, data=data, timeout=30)
        if r.status_code >= 300:
            print("eBay token error:", r.status_code, r.text[:300])
            return None
        return r.json().get("access_token")
    except Exception as e:
        print("eBay token exception:", e)
        return None


def ebay_search_offers(config: dict, token: str | None) -> list[dict]:
    if not token:
        return []

    offers = []
    query = config.get("shopping_query") or config["query"]

    for marketplace in EBAY_MARKETPLACES:
        try:
            headers = {
                "Authorization": f"Bearer {token}",
                "X-EBAY-C-MARKETPLACE-ID": marketplace,
            }
            params = {
                "q": query[:100],
                "limit": "8",
                "sort": "price",
                "filter": "buyingOptions:{FIXED_PRICE}",
            }
            r = requests.get("https://api.ebay.com/buy/browse/v1/item_summary/search", headers=headers, params=params, timeout=40)
            if r.status_code >= 300:
                print("eBay search error:", marketplace, config["name"], r.status_code, r.text[:250])
                continue

            data = r.json()
            for item in data.get("itemSummaries", [])[:8]:
                title = item.get("title", "")
                if not title or not matches_catalog(title, config):
                    continue

                price = item.get("price", {}) or {}
                amount = price.get("value")
                currency = price.get("currency")
                if amount is None:
                    continue

                price_chf = currency_to_chf(float(amount), currency)
                if price_chf is None:
                    continue

                loc = item.get("itemLocation", {}) or {}
                country = loc.get("country") or marketplace.replace("EBAY_", "")
                link = item.get("itemAffiliateWebUrl") or item.get("itemWebUrl") or ""

                offers.append({
                    "title": clean_product_text(title),
                    "price_chf": price_chf,
                    "currency": currency or "UNKNOWN",
                    "source": f"eBay API / {marketplace}",
                    "platform": "eBay",
                    "country": country,
                    "url": link,
                    "raw_price": f"{amount} {currency}",
                    "delivery": "À vérifier sur eBay",
                    "catalog_name": config["name"],
                    "is_active": True,
                })
        except Exception as e:
            print("eBay exception:", marketplace, config["name"], e)

    return offers

# =========================
# EMAIL ALERTES, OPTIONNEL
# =========================

def decode_mime_header(value: str | None) -> str:
    if not value:
        return ""
    parts = decode_header(value)
    decoded = []
    for part, enc in parts:
        if isinstance(part, bytes):
            decoded.append(part.decode(enc or "utf-8", errors="ignore"))
        else:
            decoded.append(part)
    return "".join(decoded)


def extract_text_from_email_message(msg) -> str:
    chunks = []
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            if content_type in ["text/plain", "text/html"]:
                payload = part.get_payload(decode=True)
                if payload:
                    chunks.append(payload.decode(part.get_content_charset() or "utf-8", errors="ignore"))
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            chunks.append(payload.decode(msg.get_content_charset() or "utf-8", errors="ignore"))

    text = "\n".join(chunks)
    text = BeautifulSoup(text, "html.parser").get_text(" ", strip=True)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def detect_country_from_url_or_sender(url: str, sender: str) -> str:
    blob = (url + " " + sender).lower()
    if any(x in blob for x in ["ricardo.ch", "tutti.ch", "anibis.ch", ".ch"]):
        return "CH"
    if ".fr" in blob:
        return "FR"
    if ".de" in blob:
        return "DE"
    if ".co.uk" in blob or ".uk" in blob:
        return "GB"
    if ".com" in blob:
        return "US?"
    return "UNKNOWN"


def email_alert_offers() -> list[dict]:
    if not EMAIL_IMAP_SERVER or not EMAIL_ADDRESS or not EMAIL_APP_PASSWORD:
        return []

    offers = []
    try:
        mail = imaplib.IMAP4_SSL(EMAIL_IMAP_SERVER)
        mail.login(EMAIL_ADDRESS, EMAIL_APP_PASSWORD)
        mail.select("INBOX")

        status, data = mail.search(None, "UNSEEN")
        if status != "OK":
            return []

        ids = data[0].split()[-25:]
        for msg_id in ids:
            status, msg_data = mail.fetch(msg_id, "(BODY.PEEK[])")
            if status != "OK":
                continue

            raw = msg_data[0][1]
            msg = email.message_from_bytes(raw)
            subject = decode_mime_header(msg.get("Subject"))
            sender = decode_mime_header(msg.get("From"))
            body = extract_text_from_email_message(msg)
            combined = f"{subject} {body}"

            urls = re.findall(r"https?://[^\s<>\"]+", combined)
            price_chf, currency = parse_price_to_chf(combined)
            if price_chf is None:
                continue

            first_url = urls[0] if urls else ""
            country = detect_country_from_url_or_sender(first_url, sender)
            source = domain_from_url(first_url) or sender or "Email Alert"

            for config in CATALOG:
                if matches_catalog(combined, config):
                    offers.append({
                        "title": clean_product_text(subject or config["name"]),
                        "price_chf": price_chf,
                        "currency": currency,
                        "source": f"Email / {source}",
                        "platform": source,
                        "country": country,
                        "url": first_url,
                        "raw_price": f"{price_chf} CHF approx",
                        "delivery": "Depuis email d'alerte",
                        "catalog_name": config["name"],
                        "is_active": True,
                    })
                    break

        mail.logout()
    except Exception as e:
        print("Email alert error:", e)

    return offers

# =========================
# ANALYSE OFFRES / ARBITRAGE
# =========================

def dedupe_offers(offers: list[dict]) -> list[dict]:
    seen = set()
    clean = []
    for offer in offers:
        key = offer.get("url") or (offer.get("title", "") + str(offer.get("price_chf")))
        if key in seen:
            continue
        seen.add(key)
        clean.append(offer)
    return clean


def reference_by_catalog(references: list[dict]) -> dict:
    return {r["catalog_name"]: r for r in references}


def evaluate_offer(offer: dict, ref: dict | None) -> dict | None:
    if not ref:
        return None

    price_chf = float(offer.get("price_chf") or 0)
    if price_chf <= 0:
        return None

    swiss_range = ref.get("swiss_range")
    low, high = swiss_range if swiss_range else (None, None)

    country = str(offer.get("country") or "").upper()
    is_swiss = country == "CH" or ".ch" in str(offer.get("url", "")).lower()

    ref_chf = float(ref["main_chf"])
    liquidity = ref.get("liquidity", "Inconnue")

    net_export = round(ref_chf * (1 - SELLING_FEE_RATE) - EXPORT_SHIPPING_BUFFER_CHF, 2)
    profit_export = round(net_export - price_chf, 2)
    roi_export = round((profit_export / price_chf) * 100, 1) if price_chf > 0 else 0

    landed_import = round(price_chf + IMPORT_SHIPPING_BUFFER_CHF + IMPORT_DUTY_BUFFER_CHF, 2)
    target_swiss_sale = low if low else None
    profit_import = round(target_swiss_sale - landed_import, 2) if target_swiss_sale else None
    roi_import = round((profit_import / landed_import) * 100, 1) if profit_import is not None and landed_import > 0 else None

    score = 35
    direction = "Analyse"
    verdict = "⚪ Pas assez intéressant"
    profit = 0
    roi = 0

    if is_swiss:
        direction = "Acheter en Suisse → vendre à l'étranger"
        profit = profit_export
        roi = roi_export
        if profit_export >= 100 and roi_export >= 25:
            score += 50
            verdict = "🔥 EXPORT DEAL POTENTIEL"
        elif profit_export >= MIN_PROFIT_CHF and roi_export >= 15:
            score += 35
            verdict = "🟢 Export intéressant"
        elif profit_export > 0:
            score += 15
            verdict = "🟡 Petite marge export possible"
        else:
            score -= 15
    else:
        direction = "Acheter à l'étranger → vendre en Suisse"
        profit = profit_import if profit_import is not None else -999
        roi = roi_import if roi_import is not None else 0
        if profit_import is not None and profit_import >= MIN_PROFIT_CHF and roi >= 15:
            score += 35
            verdict = "🟢 Import intéressant"
        elif profit_import is not None and profit_import > 0:
            score += 12
            verdict = "🟡 Petite marge import possible"
        else:
            score -= 10

    if liquidity == "Forte":
        score += 15
    elif liquidity == "Moyenne":
        score += 8
    elif liquidity == "Faible":
        score += 3

    if is_excluded(offer.get("title", ""), []):
        score -= 30
        verdict = "⚠️ Risque filtre / langue / produit"

    score = max(0, min(100, score))

    return {
        "offer": offer,
        "reference": ref,
        "direction": direction,
        "verdict": verdict,
        "score": score,
        "profit": profit,
        "roi": roi,
        "net_export": net_export,
        "profit_export": profit_export,
        "roi_export": roi_export,
        "landed_import": landed_import,
        "profit_import": profit_import,
        "roi_import": roi_import,
    }


def reference_market_note(ref: dict) -> str:
    swiss = ref.get("swiss_range")
    if not swiss:
        return "Marché suisse non calibré"
    low, high = swiss
    chf = ref["main_chf"]
    if chf > high:
        return "International supérieur à la base suisse : surveiller export Suisse → étranger"
    if chf < low:
        return "International inférieur à la base suisse : surveiller import étranger → Suisse"
    return "International cohérent avec la base suisse"

# =========================
# MAIN
# =========================

def main():
    references = []
    errors = []

    for config in CATALOG:
        try:
            references.extend(pricecharting_search(config))
        except Exception as e:
            errors.append(f"PriceCharting {config['name']} : {e}")

    refs = reference_by_catalog(references)

    ebay_token = ebay_get_token()

    offers = []
    source_status = []

    if SERPAPI_API_KEY:
        before = len(offers)
        for config in CATALOG:
            offers.extend(serpapi_google_shopping_offers(config))
        source_status.append(f"Google Shopping / SerpApi : {len(offers) - before} offres")
    else:
        source_status.append("Google Shopping / SerpApi : désactivé, secret SERPAPI_API_KEY manquant")

    if ebay_token:
        before = len(offers)
        for config in CATALOG:
            offers.extend(ebay_search_offers(config, ebay_token))
        source_status.append(f"eBay API : {len(offers) - before} offres")
    else:
        source_status.append("eBay API : désactivé, secrets eBay manquants ou compte pas encore validé")

    before = len(offers)
    offers.extend(email_alert_offers())
    source_status.append(f"Alertes email : {len(offers) - before} offres")

    offers = dedupe_offers(offers)

    evaluated = []
    for offer in offers:
        ref = refs.get(offer.get("catalog_name"))
        result = evaluate_offer(offer, ref)
        if result:
            evaluated.append(result)

    evaluated = sorted(evaluated, key=lambda x: x["score"], reverse=True)
    references = sorted(references, key=lambda x: x["score"], reverse=True)

    good_deals = [x for x in evaluated if x["score"] >= DEAL_ALERT_MIN_SCORE]
    export_deals = [x for x in good_deals if "Suisse" in x["direction"]]
    import_deals = [x for x in good_deals if "étranger" in x["direction"]]

    send_telegram(f"""🔎 DEAL HUNTER AI — UNIVERSAL DEAL ENGINE V6

Statut :
Moteur multi-sources activé.

Objectif :
Trouver des offres achetables partout où c'est possible, puis comparer avec PriceCharting et le marché suisse.

Sources :
{chr(10).join(source_status)}

Références PriceCharting :
{len(references)}

Offres achetables détectées :
{len(offers)}

Offres analysées :
{len(evaluated)}

Deals au-dessus du seuil :
{len(good_deals)}

Export Suisse → étranger :
{len(export_deals)}

Import étranger → Suisse :
{len(import_deals)}

Seuil alerte :
{DEAL_ALERT_MIN_SCORE}/100

Conversions :
USD {USD_TO_CHF} / EUR {EUR_TO_CHF} / GBP {GBP_TO_CHF} / JPY {JPY_TO_CHF}

Heure :
{datetime.utcnow().isoformat()} UTC
""")

    if errors:
        send_telegram("⚠️ Erreurs détectées\n\n" + "\n".join(errors[:10]))

    if good_deals:
        for item in good_deals[:MAX_DEAL_MESSAGES]:
            offer = item["offer"]
            ref = item["reference"]
            swiss = ref.get("swiss_range")
            swiss_text = f"{swiss[0]}–{swiss[1]} CHF" if swiss else "Non calibré"

            send_telegram(f"""🚨 DEAL HUNTER AI — OFFRE ACHETABLE ANALYSÉE

Verdict :
{item['verdict']}

Score :
{item['score']}/100

Direction :
{item['direction']}

Offre :
{offer.get('title')}

Prix offre :
{offer.get('price_chf')} CHF
Prix original :
{offer.get('raw_price', 'Non précisé')}

Source :
{offer.get('source')}
Pays :
{offer.get('country')}
Livraison :
{offer.get('delivery', 'À vérifier')}

Référence marché :
{ref.get('catalog_name')}

PriceCharting :
{ref.get('main_usd')} USD ≈ {ref.get('main_chf')} CHF

Marché suisse estimé :
{swiss_text}

Liquidité :
{ref.get('liquidity')}
Signal ventes :
{ref.get('sales_count_signal')}

Profit estimé :
{item['profit']} CHF
ROI estimé :
{item['roi']} %

Net export estimé :
{item['net_export']} CHF
Coût import estimé :
{item['landed_import']} CHF

Lien offre :
{offer.get('url')}

Lien référence :
{ref.get('url')}

Action :
Vérifier disponibilité, état scellé, langue, frais de port et vendeur avant achat.
""")
    else:
        send_telegram("⚪ Aucune offre achetable assez intéressante détectée sur ce passage. Le moteur reste actif et continuera à comparer les sources disponibles.")

    for ref in references[:MAX_REFERENCE_MESSAGES]:
        swiss = ref.get("swiss_range")
        swiss_text = f"{swiss[0]}–{swiss[1]} CHF" if swiss else "Non calibré"
        buy_links = "Aucun lien externe exploitable détecté"
        if ref.get("buy_links"):
            buy_links = "\n".join(ref["buy_links"][:3])

        send_telegram(f"""📊 DEAL HUNTER AI — RÉFÉRENCE MARCHÉ

Produit :
{ref.get('catalog_name')}

Score référence :
{ref.get('score')}/100

Produit PriceCharting :
{ref.get('product')}

Prix international :
{ref.get('main_usd')} USD ≈ {ref.get('main_chf')} CHF

Marché suisse estimé :
{swiss_text}

Lecture :
{reference_market_note(ref)}

Liquidité :
{ref.get('liquidity')}
Signal ventes :
{ref.get('sales_count_signal')}

Disponibilité PriceCharting :
{ref.get('availability')}

Liens externes détectés :
{buy_links}

Lien référence :
{ref.get('url')}
""")


if __name__ == "__main__":
    main()