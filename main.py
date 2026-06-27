import os
import re
import time
import base64
import imaplib
import email
from email.header import decode_header
from datetime import datetime
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup
import market_evidence

# =========================
# CONFIGURATION
# =========================

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

SERPAPI_API_KEY = os.getenv("SERPAPI_API_KEY")

EBAY_CLIENT_ID = os.getenv("EBAY_CLIENT_ID")
EBAY_CLIENT_SECRET = os.getenv("EBAY_CLIENT_SECRET")

EMAIL_IMAP_SERVER = os.getenv("EMAIL_IMAP_SERVER") or os.getenv("DEAL_IMAP_SERVER")
EMAIL_ADDRESS = os.getenv("EMAIL_ADDRESS") or os.getenv("DEAL_EMAIL_ADDRESS")
EMAIL_APP_PASSWORD = os.getenv("EMAIL_APP_PASSWORD") or os.getenv("DEAL_EMAIL_APP_PASSWORD")


def env_float(name, default):
    value = os.getenv(name)
    if value is None or str(value).strip() == "":
        return default
    try:
        return float(str(value).replace(",", "."))
    except Exception:
        return default


def env_int(name, default):
    value = os.getenv(name)
    if value is None or str(value).strip() == "":
        return default
    try:
        return int(value)
    except Exception:
        return default


USD_TO_CHF = env_float("USD_TO_CHF", 0.89)
EUR_TO_CHF = env_float("EUR_TO_CHF", 0.96)
GBP_TO_CHF = env_float("GBP_TO_CHF", 1.13)
JPY_TO_CHF = env_float("JPY_TO_CHF", 0.0058)

MAX_REFERENCE_MESSAGES = env_int("MAX_REFERENCE_MESSAGES", 2)
MAX_DEAL_MESSAGES = env_int("MAX_DEAL_MESSAGES", 6)
MAX_WATCH_MESSAGES = env_int("MAX_WATCH_MESSAGES", 6)
MAX_NEAR_MISS_MESSAGES = env_int("MAX_NEAR_MISS_MESSAGES", 6)
MAX_REJECTED_MESSAGES = env_int("MAX_REJECTED_MESSAGES", 6)

DEAL_ALERT_MIN_SCORE = env_int("DEAL_ALERT_MIN_SCORE", 75)
WATCH_MIN_SCORE = env_int("WATCH_MIN_SCORE", 45)
MARKET_WATCH_MIN_SCORE = env_int("MARKET_WATCH_MIN_SCORE", 55)
MIN_SELLER_CONFIDENCE_FOR_AUTO_DEAL = env_int("MIN_SELLER_CONFIDENCE_FOR_AUTO_DEAL", 50)
MIN_MARKET_EVIDENCE_FOR_SOLID_DEAL = env_int("MIN_MARKET_EVIDENCE_FOR_SOLID_DEAL", 55)
REQUIRE_MARKET_EVIDENCE_FOR_SOLID_DEAL = env_int("REQUIRE_MARKET_EVIDENCE_FOR_SOLID_DEAL", 1)

SELLING_FEE_RATE = env_float("SELLING_FEE_RATE", 0.13)
EXPORT_SHIPPING_BUFFER_CHF = env_float("EXPORT_SHIPPING_BUFFER_CHF", 25)
IMPORT_SHIPPING_BUFFER_CHF = env_float("IMPORT_SHIPPING_BUFFER_CHF", 22)
IMPORT_DUTY_BUFFER_CHF = env_float("IMPORT_DUTY_BUFFER_CHF", 10)
MIN_PROFIT_CHF = env_float("MIN_PROFIT_CHF", 30)

PRICECHARTING_SLEEP_SECONDS = env_float("PRICECHARTING_SLEEP_SECONDS", 2.0)


RAW_SERPAPI_COUNTRIES = os.getenv("SERPAPI_COUNTRIES")
if RAW_SERPAPI_COUNTRIES is None or RAW_SERPAPI_COUNTRIES.strip() == "":
    SERPAPI_COUNTRIES = ["ch"]
else:
    SERPAPI_COUNTRIES = [x.strip().lower() for x in RAW_SERPAPI_COUNTRIES.split(",") if x.strip()]


RAW_EBAY_MARKETPLACES = os.getenv("EBAY_MARKETPLACES")
if RAW_EBAY_MARKETPLACES is None or RAW_EBAY_MARKETPLACES.strip() == "":
    EBAY_MARKETPLACES = ["EBAY_CH", "EBAY_US", "EBAY_GB"]
else:
    EBAY_MARKETPLACES = [x.strip() for x in RAW_EBAY_MARKETPLACES.split(",") if x.strip()]


SHOPPING_COUNTRY_CONFIG = {
    "ch": {
        "gl": "ch",
        "hl": "fr",
        "google_domain": "google.ch",
        "location": "Switzerland",
        "search_country": "CH",
        "default_currency": "CHF",
    },
    "fr": {
        "gl": "fr",
        "hl": "fr",
        "google_domain": "google.fr",
        "location": "France",
        "search_country": "FR",
        "default_currency": "EUR",
    },
    "de": {
        "gl": "de",
        "hl": "de",
        "google_domain": "google.de",
        "location": "Germany",
        "search_country": "DE",
        "default_currency": "EUR",
    },
    "uk": {
        "gl": "uk",
        "hl": "en",
        "google_domain": "google.co.uk",
        "location": "United Kingdom",
        "search_country": "GB",
        "default_currency": "GBP",
    },
    "gb": {
        "gl": "uk",
        "hl": "en",
        "google_domain": "google.co.uk",
        "location": "United Kingdom",
        "search_country": "GB",
        "default_currency": "GBP",
    },
    "us": {
        "gl": "us",
        "hl": "en",
        "google_domain": "google.com",
        "location": "United States",
        "search_country": "US",
        "default_currency": "USD",
    },
}


# =========================
# CATALOGUE STRICT + BASE INTERNE
# =========================

CATALOG = [
    {
        "name": "Pokémon Evolving Skies EN Booster Box",
        "query": "pokemon evolving skies booster box",
        "shopping_query": "Pokemon Evolving Skies booster box sealed",
        "required": ["pokemon", "evolving skies", "booster box"],
        "exclude": [
            "half booster",
            "korean",
            "chinese",
            "german",
            "deutsch",
            "italian",
            "spanish",
            "single pack",
            "proxy",
        ],
        "swiss_range": (650, 850),
        "fallback_international_chf": 2200,
        "fallback_confidence": "Moyenne",
    },
    {
        "name": "Pokémon 151 JP Booster Box",
        "query": "pokemon japanese scarlet violet 151 booster box",
        "shopping_query": "Pokemon Japanese Scarlet Violet 151 booster box sealed display",
        "required": ["pokemon", "japanese", "151", "booster box"],
        "exclude": [
            "chinese",
            "korean",
            "surprise",
            "jumbo",
            "slim",
            "volume",
            "mini tin",
            "poster",
            "binder",
            "single pack",
        ],
        "swiss_range": (115, 145),
        "fallback_international_chf": 265,
        "fallback_confidence": "Moyenne",
    },
    {
        "name": "Pokémon Eevee Heroes JP Booster Box",
        "query": "pokemon japanese eevee heroes booster box",
        "shopping_query": "Pokemon Japanese Eevee Heroes booster box sealed display",
        "required": ["pokemon", "japanese", "eevee heroes", "booster box"],
        "exclude": ["korean", "chinese", "single pack"],
        "swiss_range": (420, 550),
        "fallback_international_chf": 750,
        "fallback_confidence": "Moyenne",
    },
    {
        "name": "Pokémon VSTAR Universe JP Booster Box",
        "query": "pokemon japanese vstar universe booster box",
        "shopping_query": "Pokemon Japanese VSTAR Universe booster box sealed display",
        "required": ["pokemon", "japanese", "vstar universe", "booster box"],
        "exclude": ["korean", "chinese", "single pack"],
        "swiss_range": (95, 130),
        "fallback_international_chf": 185,
        "fallback_confidence": "Moyenne",
    },
    {
        "name": "Pokémon VMAX Climax JP Booster Box",
        "query": "pokemon japanese vmax climax booster box",
        "shopping_query": "Pokemon Japanese VMAX Climax booster box sealed display",
        "required": ["pokemon", "japanese", "vmax climax", "booster box"],
        "exclude": ["korean", "chinese", "single pack", "time warp", "subscribe"],
        "swiss_range": (130, 180),
        "fallback_international_chf": 170,
        "fallback_confidence": "Moyenne",
    },
    {
        "name": "Pokémon Terastal Festival JP Booster Box",
        "query": "pokemon japanese terastal festival booster box",
        "shopping_query": "Pokemon Japanese Terastal Festival booster box sealed display",
        "required": ["pokemon", "japanese", "terastal festival", "booster box"],
        "exclude": ["korean", "chinese", "single pack"],
        "swiss_range": (85, 120),
        "fallback_international_chf": 85,
        "fallback_confidence": "Moyenne",
    },
    {
        "name": "Pokémon Blue Sky Stream JP Booster Box",
        "query": "pokemon japanese blue sky stream booster box",
        "shopping_query": "Pokemon Japanese Blue Sky Stream booster box sealed display",
        "required": ["pokemon", "japanese", "blue sky stream", "booster box"],
        "exclude": ["korean", "chinese", "single pack"],
        "swiss_range": (130, 190),
        "fallback_international_chf": 160,
        "fallback_confidence": "Moyenne",
    },
    {
        "name": "Pokémon Dream League JP Booster Box",
        "query": "pokemon japanese dream league booster box",
        "shopping_query": "Pokemon Japanese Dream League booster box sealed display",
        "required": ["pokemon", "japanese", "dream league", "booster box"],
        "exclude": ["korean", "chinese", "single pack"],
        "swiss_range": (230, 330),
        "fallback_international_chf": 740,
        "fallback_confidence": "Faible",
    },
    {
        "name": "Topps Chrome UEFA Hobby Box",
        "query": "topps chrome uefa hobby box",
        "shopping_query": "Topps Chrome UEFA hobby box sealed",
        "required": ["topps", "chrome", "hobby box"],
        "any_of": ["uefa", "ucl", "champions"],
        "exclude": ["disney", "marvel", "star wars", "baseball", "formula", "f1"],
        "swiss_range": (90, 150),
        "fallback_international_chf": 130,
        "fallback_confidence": "Faible",
    },
    {
        "name": "One Piece Carrying On His Will Booster Box",
        "query": "one piece carrying on his will booster box",
        "shopping_query": "One Piece Carrying On His Will booster box sealed",
        "required": ["one piece", "carrying on his will", "booster box"],
        "exclude": [
            "op-14",
            "op-12",
            "azure",
            "egghead",
            "legacy",
            "korean",
            "chinese",
            "proxy",
            "single pack",
            "jumbo",
            "oversized",
            "giant",
        ],
        "swiss_range": (90, 150),
        "fallback_international_chf": 445,
        "fallback_confidence": "Moyenne",
    },
    {
        "name": "Lorcana Wilds Unknown Booster Box",
        "query": "lorcana wilds unknown booster box",
        "shopping_query": "Lorcana Wilds Unknown booster box sealed",
        "required": ["lorcana", "wilds unknown", "booster box"],
        "exclude": ["german", "deutsch", "italian", "spanish", "single pack"],
        "swiss_range": (180, 230),
        "fallback_international_chf": 190,
        "fallback_confidence": "Moyenne",
    },
]


GLOBAL_EXCLUDE = [
    "thai",
    "indonesian",
    "portuguese",
    "proxy",
    "fake",
    "custom",
    "orica",
    "repack",
    "digital",
    "empty",
    "wrapper",
    "playmat",
    "sleeves",
    "deck box",
    "pricecharting-pro",
    "subscribe",
    "time warp",
]


BAD_SOURCE_TERMS = [
    "aliexpress",
    "temu",
    "wish",
    "dhgate",
    "alibaba",
    "made in china",
    "replica",
    "unbranded",
]


BAD_BOOSTER_BOX_TYPE_TERMS = [
    "special set",
    "vmax special",
    "gym set",
    "premium collection",
    "collection box",
    "elite trainer",
    " etb",
    "bundle",
    "mini tin",
    " tin",
    "single pack",
    "loose pack",
    "pack lot",
    "packs lot",
    "lot of",
    "sealed case",
    "case of",
    "deck",
    "starter deck",
    "jumbo",
    "oversized",
    "giant",
]


SWISS_SOURCE_HINTS = [
    "ricardo.ch",
    "tutti.ch",
    "anibis.ch",
    "galaxus",
    "digitec",
    "brack",
    "wog.ch",
    "world of games",
    "cardtreasure",
    "poke-geek",
    "tcg-store.ch",
    "cardsparadise",
    "cardcollect",
    "fantasybasel",
]


TRUSTED_SHOP_TERMS = [
    "galaxus",
    "digitec",
    "brack",
    "wog.ch",
    "world of games",
    "cardtreasure",
    "poke-geek",
    "tcg-store.ch",
    "cardsparadise",
    "cardcollect",
    "fantasybasel",
]


MEDIUM_TRUST_TERMS = [
    "ricardo.ch",
    "tutti.ch",
    "anibis.ch",
    "japan2uk",
    "stockx",
    "cardmarket",
]

# =========================
# OUTILS
# =========================

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
    low = str(text or "").lower()
    replacements = {
        "&": " and ",
        "é": "e",
        "è": "e",
        "ê": "e",
        "ë": "e",
        "à": "a",
        "â": "a",
        "î": "i",
        "ï": "i",
        "ô": "o",
        "ö": "o",
        "ù": "u",
        "û": "u",
        "ü": "u",
        "ç": "c",
        "japonais": "japanese",
        "japonaise": "japanese",
        "japon": "japanese",
        "japanisch": "japanese",
        "jp": "japanese",
        "jpn": "japanese",
        "japan": "japanese",
        "boite": "box",
        "boîte": "box",
        "display": "booster display",
        "booster display": "booster display",
        "hobby display": "hobby box",
    }

    for a, b in replacements.items():
        low = low.replace(a, b)

    low = re.sub(r"[^a-z0-9$€£¥.%,:/?=&+\-’' ]+", " ", low)
    low = re.sub(r"\s+", " ", low).strip()
    return low


def is_booster_box_config(config: dict) -> bool:
    return any(normalize(x) == "booster box" for x in config.get("required", []))


def is_wrong_booster_box_type(text: str) -> bool:
    low = " " + normalize(text) + " "
    return any(term in low for term in BAD_BOOSTER_BOX_TYPE_TERMS)


def keyword_present(text: str, keyword: str) -> bool:
    low = normalize(text)
    key = normalize(keyword)

    if key == "booster box":
        return any(
            x in low
            for x in [
                "booster box",
                "booster display",
                "display box",
                "sealed display",
                "booster display box",
                "display booster",
            ]
        )

    if key == "hobby box":
        return any(x in low for x in ["hobby box", "hobby display", "box hobby"])

    if key == "japanese":
        return any(x in low for x in ["japanese", "japon", "japonais", "japanisch"])

    return key in low


def contains_all(text: str, words: list[str]) -> bool:
    return all(keyword_present(text, word) for word in words)


def contains_any(text: str, words: list[str]) -> bool:
    return any(keyword_present(text, word) for word in words)


def is_excluded(text: str, extra_exclude: list[str] | None = None) -> bool:
    low = normalize(text)
    banned = GLOBAL_EXCLUDE + (extra_exclude or [])
    return any(normalize(word) in low for word in banned)


def is_bad_source(source: str, url: str, title: str = "") -> bool:
    blob = normalize(f"{source} {url} {title}")
    return any(term in blob for term in BAD_SOURCE_TERMS)


def related_to_catalog_without_box(text: str, config: dict) -> bool:
    required = [
        word for word in config.get("required", [])
        if normalize(word) not in ["booster box", "hobby box"]
    ]

    if required and not contains_all(text, required):
        return False

    any_of = config.get("any_of")
    if any_of and not contains_any(text, any_of):
        return False

    return True


def matches_catalog(text: str, config: dict) -> bool:
    if is_excluded(text, config.get("exclude", [])):
        return False

    if is_booster_box_config(config) and is_wrong_booster_box_type(text):
        return False

    if not contains_all(text, config["required"]):
        return False

    any_of = config.get("any_of")
    if any_of and not contains_any(text, any_of):
        return False

    return True


def clean_number(raw: str) -> float:
    raw = str(raw).strip()
    raw = raw.replace("’", "'")
    raw = raw.replace(" ", "")
    raw = raw.replace("'", "")

    if "," in raw and "." in raw:
        raw = raw.replace(",", "")
    elif "," in raw and "." not in raw:
        if len(raw.split(",")[-1]) == 2:
            raw = raw.replace(",", ".")
        else:
            raw = raw.replace(",", "")

    return float(raw)


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


def parse_price_to_chf(price_text: str | None, extracted_price=None, currency_hint: str | None = None, default_currency: str | None = None):
    text = str(price_text or "")

    patterns = [
        (r"(?:CHF|SFr\.?|Fr\.?)\s*([0-9][0-9'’., ]*)", "CHF"),
        (r"([0-9][0-9'’., ]*)\s*(?:CHF|SFr\.?|Fr\.?)", "CHF"),
        (r"€\s*([0-9][0-9'’., ]*)", "EUR"),
        (r"([0-9][0-9'’., ]*)\s*€", "EUR"),
        (r"\$\s*([0-9][0-9'’., ]*)", "USD"),
        (r"£\s*([0-9][0-9'’., ]*)", "GBP"),
        (r"¥\s*([0-9][0-9'’., ]*)", "JPY"),
    ]

    for pattern, cur in patterns:
        m = re.search(pattern, text, flags=re.I)
        if not m:
            continue

        try:
            amount = clean_number(m.group(1))
            chf = currency_to_chf(amount, cur)
            if chf is not None:
                return chf, cur
        except Exception:
            continue

    if currency_hint and extracted_price is not None:
        try:
            amount = float(extracted_price)
            chf = currency_to_chf(amount, currency_hint)
            if chf is not None:
                return chf, currency_hint.upper()
        except Exception:
            pass

    if default_currency and extracted_price is not None:
        try:
            amount = float(extracted_price)
            chf = currency_to_chf(amount, default_currency)
            if chf is not None:
                return chf, default_currency.upper()
        except Exception:
            pass

    return None, "UNKNOWN"


def extract_price_strings_usd(text: str) -> list[str]:
    return re.findall(r"\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?", str(text))


def price_to_float(price: str) -> float:
    cleaned = (
        str(price)
        .replace("$", "")
        .replace("€", "")
        .replace("£", "")
        .replace("¥", "")
        .replace("CHF", "")
        .replace("USD", "")
        .replace("EUR", "")
        .replace("GBP", "")
        .replace("JPY", "")
        .strip()
    )
    return clean_number(cleaned)


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


def detect_seller_country(source: str, url: str) -> str:
    blob = normalize(f"{source} {url}")

    if any(term in blob for term in SWISS_SOURCE_HINTS):
        return "CH"

    if ".ch" in blob and "google.ch" not in blob:
        return "CH"

    if "ebay" in blob:
        return "EBAY_UNKNOWN"

    if "stockx" in blob:
        return "INTERNATIONAL"

    return "UNKNOWN"


def compute_seller_confidence(offer: dict) -> dict:
    title = offer.get("title", "")
    source = offer.get("source", "")
    platform = offer.get("platform", "")
    url = offer.get("url", "")
    seller_country = str(offer.get("seller_country") or "UNKNOWN").upper()

    blob = normalize(f"{title} {source} {platform} {url}")

    if is_bad_source(source, url, title):
        return {
            "seller_confidence_score": 0,
            "seller_confidence_label": "🔴 Très faible",
            "seller_risk": "Source exclue ou plateforme à risque",
            "seller_action": "Ignorer",
        }

    if any(term in blob for term in TRUSTED_SHOP_TERMS):
        return {
            "seller_confidence_score": 85,
            "seller_confidence_label": "🟢 Forte",
            "seller_risk": "Boutique ou source suisse connue",
            "seller_action": "Vérifier stock, état scellé et frais, puis achat possible si le prix est bon",
        }

    if "ricardo.ch" in blob:
        return {
            "seller_confidence_score": 70,
            "seller_confidence_label": "🟡 Moyenne à forte",
            "seller_risk": "Marketplace suisse : vendeur individuel à vérifier",
            "seller_action": "Vérifier profil vendeur, évaluations, photos réelles et possibilité de remise en main propre",
        }

    if any(term in blob for term in MEDIUM_TRUST_TERMS):
        return {
            "seller_confidence_score": 60,
            "seller_confidence_label": "🟡 Moyenne",
            "seller_risk": "Source connue mais vendeur/frais à contrôler",
            "seller_action": "Vérifier vendeur, frais de port, pays d’expédition, TVA et état scellé",
        }

    if "ebay" in blob and seller_country == "EBAY_UNKNOWN":
        return {
            "seller_confidence_score": 35,
            "seller_confidence_label": "🟠 Faible",
            "seller_risk": "eBay via Google Shopping : pays vendeur et annonce réelle non confirmés",
            "seller_action": "Ne pas acheter automatiquement. Ouvrir l’annonce, vérifier vendeur, photos, stock, frais, retours et authenticité",
        }

    if "ebay" in blob:
        return {
            "seller_confidence_score": 45,
            "seller_confidence_label": "🟠 Faible à moyenne",
            "seller_risk": "eBay : vendeur à contrôler manuellement",
            "seller_action": "Vérifier profil vendeur, pays d’expédition, frais, photos réelles et protection acheteur",
        }

    if seller_country == "CH":
        return {
            "seller_confidence_score": 55,
            "seller_confidence_label": "🟡 Moyenne",
            "seller_risk": "Vendeur suisse détecté, mais source pas totalement qualifiée",
            "seller_action": "Vérifier identité du vendeur, état scellé, photos et remise possible",
        }

    if seller_country in ["UNKNOWN", "INTERNATIONAL", "EBAY_UNKNOWN"]:
        return {
            "seller_confidence_score": 30,
            "seller_confidence_label": "🔴 Faible",
            "seller_risk": "Vendeur ou pays non confirmé",
            "seller_action": "Vérification obligatoire avant tout achat",
        }

    return {
        "seller_confidence_score": 50,
        "seller_confidence_label": "🟡 Moyenne",
        "seller_risk": "Source partiellement exploitable, détails à vérifier",
        "seller_action": "Vérifier vendeur, frais, état scellé, langue et photos",
    }


# =========================
# RÉFÉRENCES MARCHÉ
# =========================

def compute_reference_score(main_chf: float, swiss_range: tuple[int, int] | None, source: str) -> int:
    score = 48

    if source == "PriceCharting":
        score += 8
    elif source == "Base interne":
        score += 2

    if swiss_range:
        low, high = swiss_range

        if main_chf > high:
            score += 10
        elif low <= main_chf <= high:
            score += 6
        elif main_chf < low:
            score += 4

    return max(0, min(100, score))


def build_internal_reference(config: dict) -> dict | None:
    fallback_chf = config.get("fallback_international_chf")
    if fallback_chf is None:
        return None

    main_chf = float(fallback_chf)
    main_usd = round(main_chf / USD_TO_CHF, 2) if USD_TO_CHF else 0

    return {
        "catalog_name": config["name"],
        "query": config["query"],
        "product": f"{config['name']} — référence interne de secours",
        "url": "Base interne Deal Hunter",
        "prices": [f"≈ {main_chf} CHF"],
        "main_usd": main_usd,
        "main_chf": main_chf,
        "swiss_range": config.get("swiss_range"),
        "liquidity": "Non mesurée",
        "sales_count_signal": 0,
        "availability": f"Base interne de secours — confiance {config.get('fallback_confidence', 'Moyenne')}",
        "buy_links": [],
        "reference_source": "Base interne",
        "confidence": config.get("fallback_confidence", "Moyenne"),
        "score": compute_reference_score(main_chf, config.get("swiss_range"), "Base interne"),
    }


def pricecharting_search(config: dict) -> list[dict]:
    url = "https://www.pricecharting.com/search-products"
    params = {"q": config["query"], "type": "prices"}

    r = requests.get(url, params=params, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)

    if r.status_code == 429:
        raise Exception("PriceCharting status 429 / trop de requêtes")

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

        if "pricecharting.com/game/" not in link:
            continue

        if link in seen_links:
            continue

        prices = extract_price_strings_usd(raw_text)
        if not prices:
            continue

        seen_links.add(link)

        product_text = clean_product_text(raw_text)
        main_usd = price_to_float(prices[0])
        main_chf = round(main_usd * USD_TO_CHF, 2)

        results.append(
            {
                "catalog_name": config["name"],
                "query": config["query"],
                "product": product_text,
                "url": link,
                "prices": prices[:3],
                "main_usd": main_usd,
                "main_chf": main_chf,
                "swiss_range": config.get("swiss_range"),
                "liquidity": "Non mesurée",
                "sales_count_signal": 0,
                "availability": "PriceCharting utilisé comme référence prix uniquement",
                "buy_links": [],
                "reference_source": "PriceCharting",
                "confidence": "Moyenne",
                "score": compute_reference_score(main_chf, config.get("swiss_range"), "PriceCharting"),
            }
        )

    return results[:1]


# =========================
# SERPAPI GOOGLE SHOPPING
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

            if r.status_code != 200:
                print("SerpApi status:", r.status_code, r.text[:300])
                continue

            data = r.json()
            shopping_results = data.get("shopping_results", []) or []

            for item in shopping_results[:10]:
                title = item.get("title", "")
                if not title:
                    continue

                related = related_to_catalog_without_box(title, config)
                if not related:
                    continue

                forced_reject_reason = None

                if is_booster_box_config(config) and is_wrong_booster_box_type(title):
                    forced_reject_reason = "Mauvais type de produit : Special Set / collection / lot / case / jumbo ≠ vraie booster box"
                elif not matches_catalog(title, config):
                    continue

                link = item.get("link") or item.get("product_link") or item.get("serpapi_product_api") or ""
                source = item.get("source") or domain_from_url(link) or "Google Shopping"

                if not link:
                    continue

                if is_bad_source(source, link, title):
                    forced_reject_reason = "Source à risque exclue"

                price_text = item.get("price") or ""
                extracted = item.get("extracted_price")
                currency_hint = item.get("currency")

                price_chf, currency = parse_price_to_chf(
                    price_text,
                    extracted_price=extracted,
                    currency_hint=currency_hint,
                    default_currency=country_cfg["default_currency"],
                )

                if price_chf is None or price_chf <= 0:
                    continue

                seller_country = detect_seller_country(source, link)
                delivery = item.get("delivery") or item.get("shipping") or "À vérifier"

                offers.append(
                    {
                        "title": clean_product_text(title),
                        "price_chf": price_chf,
                        "currency": currency,
                        "source": f"Google Shopping / {source}",
                        "platform": source,
                        "seller_country": seller_country,
                        "search_country": country_cfg["search_country"],
                        "url": link,
                        "raw_price": price_text,
                        "delivery": delivery,
                        "catalog_name": config["name"],
                        "is_active": True,
                        "forced_reject_reason": forced_reject_reason,
                    }
                )

        except Exception as e:
            print("SerpApi error:", config["name"], country_key, e)

    return offers


# =========================
# EBAY API OPTIONNELLE
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

        r = requests.post(
            "https://api.ebay.com/identity/v1/oauth2/token",
            headers=headers,
            data=data,
            timeout=30,
        )

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

            r = requests.get(
                "https://api.ebay.com/buy/browse/v1/item_summary/search",
                headers=headers,
                params=params,
                timeout=40,
            )

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
                country = loc.get("country") or "UNKNOWN"
                link = item.get("itemAffiliateWebUrl") or item.get("itemWebUrl") or ""

                offers.append(
                    {
                        "title": clean_product_text(title),
                        "price_chf": price_chf,
                        "currency": currency or "UNKNOWN",
                        "source": f"eBay API / {marketplace}",
                        "platform": "eBay",
                        "seller_country": country,
                        "search_country": marketplace.replace("EBAY_", ""),
                        "url": link,
                        "raw_price": f"{amount} {currency}",
                        "delivery": "À vérifier sur eBay",
                        "catalog_name": config["name"],
                        "is_active": True,
                        "forced_reject_reason": None,
                    }
                )

        except Exception as e:
            print("eBay exception:", marketplace, config["name"], e)

    return offers


# =========================
# EMAIL ALERTES OPTIONNEL
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
            source = domain_from_url(first_url) or sender or "Email Alert"
            seller_country = detect_seller_country(source, first_url)

            for config in CATALOG:
                if matches_catalog(combined, config):
                    offers.append(
                        {
                            "title": clean_product_text(subject or config["name"]),
                            "price_chf": price_chf,
                            "currency": currency,
                            "source": f"Email / {source}",
                            "platform": source,
                            "seller_country": seller_country,
                            "search_country": "EMAIL",
                            "url": first_url,
                            "raw_price": f"{price_chf} CHF approx",
                            "delivery": "Depuis email d'alerte",
                            "catalog_name": config["name"],
                            "is_active": True,
                            "forced_reject_reason": None,
                        }
                    )
                    break

        mail.logout()

    except Exception as e:
        print("Email alert error:", e)

    return offers


# =========================
# ANALYSE
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


def reject_result(offer, ref, reason):
    seller_view = compute_seller_confidence(offer)

    return {
        "offer": offer,
        "reference": ref,
        "direction": "REJECTED",
        "direction_label": "Rejeté",
        "verdict": f"⚠️ Rejeté : {reason}",
        "score": 0,
        "profit": 0,
        "roi": 0,
        "net_export": 0,
        "landed_import": 0,
        "reason": reason,
        "target_buy_price": None,
        "gap_to_target": None,
        "gap_text": "Non calculable",
        "flip_decision": "⚠️ REJETÉ",
        "market_decision": "⚠️ REJETÉ",
        "market_score": 0,
        "market_effective_price": None,
        "market_gap_text": "Non calculable",
        "market_range_text": "Non calculable",
        "negotiation_advice": "Ne pas acheter",
        "action_recommended": "Ignorer cette offre",
        **seller_view,
    }


def make_gap_text(gap):
    if gap is None:
        return "Non calculable"
    if gap > 0:
        return f"{round(gap, 2)} CHF trop cher"
    if gap < 0:
        return f"{round(abs(gap), 2)} CHF sous le prix cible"
    return "Exactement au prix cible"


def make_negotiation_advice(offer, target_buy_price):
    if target_buy_price is None or target_buy_price <= 0:
        return "Pas de négociation conseillée"

    seller_country = str(offer.get("seller_country") or "").upper()
    source = normalize(offer.get("source", ""))

    if seller_country == "CH" or "ricardo" in source:
        low = round(target_buy_price * 0.85, 2)
        high = round(target_buy_price, 2)
        return f"Proposer environ {low}–{high} CHF, ne pas dépasser {high} CHF"

    return f"Prix max flip conseillé : {round(target_buy_price, 2)} CHF"


def compute_target_prices(direction, ref_chf, swiss_low):
    net_export = round(ref_chf * (1 - SELLING_FEE_RATE) - EXPORT_SHIPPING_BUFFER_CHF, 2)
    target_export = round(net_export - MIN_PROFIT_CHF, 2)

    target_import = round(
        swiss_low - IMPORT_SHIPPING_BUFFER_CHF - IMPORT_DUTY_BUFFER_CHF - MIN_PROFIT_CHF,
        2,
    )

    if direction == "EXPORT_CH":
        return target_export, net_export

    if direction == "IMPORT_TO_CH":
        return target_import, None

    return None, None


def compute_market_view(offer, ref, landed_import):
    swiss_range = ref.get("swiss_range")
    seller_country = str(offer.get("seller_country") or "UNKNOWN").upper()
    price_chf = float(offer.get("price_chf") or 0)

    if not swiss_range:
        return {
            "market_decision": "⚪ Marché non calibré",
            "market_score": 0,
            "market_effective_price": None,
            "market_gap_text": "Non calculable",
            "market_range_text": "Non calibré",
            "market_basis": "Non calculable",
        }

    swiss_low, swiss_high = swiss_range

    if seller_country == "CH":
        effective_price = price_chf
        basis = "Prix vendeur Suisse"
    else:
        effective_price = landed_import
        basis = "Prix rendu Suisse estimé"

    market_range_text = f"{swiss_low}–{swiss_high} CHF"

    if effective_price <= swiss_low * 0.85:
        decision = "🟢 Très bon prix marché"
        score = 80
    elif effective_price <= swiss_low:
        decision = "🟢 Bon prix marché"
        score = 70
    elif effective_price <= swiss_high:
        decision = "🟡 Prix marché correct"
        score = 60
    elif effective_price <= swiss_high * 1.15:
        decision = "🟠 Un peu cher marché"
        score = 40
    else:
        decision = "🔴 Trop cher marché"
        score = 20

    market_gap = round(effective_price - swiss_low, 2)

    if market_gap > 0:
        gap_text = f"{market_gap} CHF au-dessus du bas marché"
    elif market_gap < 0:
        gap_text = f"{abs(market_gap)} CHF sous le bas marché"
    else:
        gap_text = "Exactement au bas marché"

    return {
        "market_decision": decision,
        "market_score": score,
        "market_effective_price": round(effective_price, 2),
        "market_gap_text": gap_text,
        "market_range_text": market_range_text,
        "market_basis": basis,
    }


def make_action_recommendation(item):
    flip_score = item.get("score", 0)
    market_score = item.get("market_score", 0)
    seller_score = item.get("seller_confidence_score", 0)
    ref = item.get("reference")
    ref_source = ref.get("reference_source") if ref else "Aucune"

    if flip_score >= DEAL_ALERT_MIN_SCORE and seller_score >= MIN_SELLER_CONFIDENCE_FOR_AUTO_DEAL:
        return "Achat possible après vérification finale : stock réel, scellé, langue, frais, photos et vendeur."

    if flip_score >= DEAL_ALERT_MIN_SCORE and seller_score < MIN_SELLER_CONFIDENCE_FOR_AUTO_DEAL:
        return "Prix potentiellement bon, mais vendeur trop peu fiable : vérification manuelle obligatoire avant achat."

    if market_score >= MARKET_WATCH_MIN_SCORE and seller_score < MIN_SELLER_CONFIDENCE_FOR_AUTO_DEAL:
        return "Prix marché correct, mais vendeur risqué ou non confirmé : ne pas acheter automatiquement."

    if market_score >= MARKET_WATCH_MIN_SCORE and ref_source == "Base interne":
        return "Prix marché correct, mais référence interne : vérifier avec ventes récentes avant achat."

    if market_score >= MARKET_WATCH_MIN_SCORE:
        return "Prix marché correct : surveiller, vérifier les frais et acheter seulement si le besoin est clair."

    return "Ignorer sauf forte baisse de prix ou meilleure preuve vendeur."


def evaluate_offer(offer: dict, ref: dict | None) -> dict:
    seller_view = compute_seller_confidence(offer)

    if offer.get("forced_reject_reason"):
        return reject_result(offer, ref, offer.get("forced_reject_reason"))

    if not ref:
        return reject_result(offer, None, "Aucune référence marché exploitable")

    title = offer.get("title", "")
    price_chf = float(offer.get("price_chf") or 0)
    seller_country = str(offer.get("seller_country") or "UNKNOWN").upper()

    if price_chf <= 0:
        return reject_result(offer, ref, "Prix invalide")

    if is_bad_source(offer.get("source", ""), offer.get("url", ""), title):
        return reject_result(offer, ref, "Source exclue")

    if is_wrong_booster_box_type(title):
        return reject_result(offer, ref, "Mauvais type de produit : Special Set / collection / lot / case / jumbo ≠ vraie booster box")

    swiss_range = ref.get("swiss_range")
    if not swiss_range:
        return reject_result(offer, ref, "Pas de fourchette suisse")

    swiss_low, swiss_high = swiss_range
    ref_chf = float(ref["main_chf"])

    if price_chf < swiss_low * 0.45:
        return reject_result(offer, ref, "Prix inférieur au seuil réaliste / risque fake")

    if seller_country == "CH":
        direction = "EXPORT_CH"
        direction_label = "Acheter en Suisse → vendre à l'étranger"
    else:
        direction = "IMPORT_TO_CH"
        direction_label = "Acheter à l'étranger → vendre en Suisse"

    target_buy_price, net_export = compute_target_prices(direction, ref_chf, swiss_low)

    if direction == "EXPORT_CH":
        net_export = round(ref_chf * (1 - SELLING_FEE_RATE) - EXPORT_SHIPPING_BUFFER_CHF, 2)
        profit = round(net_export - price_chf, 2)
        roi = round((profit / price_chf) * 100, 1) if price_chf > 0 else 0
        landed_import = round(price_chf + IMPORT_SHIPPING_BUFFER_CHF + IMPORT_DUTY_BUFFER_CHF, 2)
    else:
        landed_import = round(price_chf + IMPORT_SHIPPING_BUFFER_CHF + IMPORT_DUTY_BUFFER_CHF, 2)
        profit = round(swiss_low - landed_import, 2)
        roi = round((profit / landed_import) * 100, 1) if landed_import > 0 else 0
        net_export = round(ref_chf * (1 - SELLING_FEE_RATE) - EXPORT_SHIPPING_BUFFER_CHF, 2)

    market_view = compute_market_view(offer, ref, landed_import)

    gap_to_target = round(price_chf - target_buy_price, 2) if target_buy_price is not None else None

    score = 0
    verdict = "⚪ Pas assez intéressant"
    reason = ""

    if gap_to_target is not None and gap_to_target <= 0 and profit >= MIN_PROFIT_CHF and roi >= 15:
        score = 80
        verdict = "🟢 Achat possible selon le prix cible flip"
    elif gap_to_target is not None and gap_to_target <= 25 and profit >= 0:
        score = 60
        verdict = "🟡 Très proche du prix cible flip / négocier"
        reason = "Proche du prix cible flip"
    elif gap_to_target is not None and gap_to_target <= 75:
        score = 50
        verdict = "🟡 À surveiller si baisse de prix"
        reason = "Pas assez bas pour flip, mais proche"
    else:
        score = 35
        verdict = "🔴 Trop cher pour flip"
        reason = "Prix trop éloigné du prix cible flip"

    if direction == "EXPORT_CH" and profit < MIN_PROFIT_CHF:
        reason = "Marge export insuffisante"
        if score > 40:
            score = 40

    if direction == "IMPORT_TO_CH" and profit < MIN_PROFIT_CHF:
        reason = "Marge import insuffisante ou vendeur non confirmé suisse"
        if score > 40:
            score = 40

    if ref.get("reference_source") == "Base interne":
        reason = (reason + " / " if reason else "") + "référence interne de secours"

        if seller_country in ["EBAY_UNKNOWN", "UNKNOWN", "INTERNATIONAL"] and score > 60:
            score = 60
            verdict = "🟡 À vérifier seulement : référence interne + vendeur non confirmé"

        elif seller_country == "CH" and score > 70:
            score = 70
            verdict = "🟡 À vérifier : référence interne, pas encore deal solide"

    if seller_view["seller_confidence_score"] < MIN_SELLER_CONFIDENCE_FOR_AUTO_DEAL and score >= DEAL_ALERT_MIN_SCORE:
        score = 70
        verdict = "🟡 Prix intéressant mais vendeur à vérifier"

    if gap_to_target is not None and gap_to_target > 0:
        flip_decision = "🔴 PAS POUR FLIP"
    elif score >= DEAL_ALERT_MIN_SCORE:
        flip_decision = "🟢 FLIP POSSIBLE"
    elif score >= WATCH_MIN_SCORE:
        flip_decision = "🟡 FLIP À NÉGOCIER"
    else:
        flip_decision = "🔴 PAS POUR FLIP"

    negotiation_advice = make_negotiation_advice(offer, target_buy_price)

    score = max(0, min(100, score))

    result = {
        "offer": offer,
        "reference": ref,
        "direction": direction,
        "direction_label": direction_label,
        "verdict": verdict,
        "score": score,
        "profit": profit,
        "roi": roi,
        "net_export": net_export,
        "landed_import": landed_import,
        "reason": reason,
        "target_buy_price": target_buy_price,
        "gap_to_target": gap_to_target,
        "gap_text": make_gap_text(gap_to_target),
        "flip_decision": flip_decision,
        "market_decision": market_view["market_decision"],
        "market_score": market_view["market_score"],
        "market_effective_price": market_view["market_effective_price"],
        "market_gap_text": market_view["market_gap_text"],
        "market_range_text": market_view["market_range_text"],
        "market_basis": market_view["market_basis"],
        "negotiation_advice": negotiation_advice,
        **seller_view,
    }

    result["action_recommended"] = make_action_recommendation(result)
    return result

def attach_market_evidence(result):
    ref = result.get("reference")

    if not ref:
        result["market_evidence"] = None
        result["evidence_score"] = 0
        result["evidence_sales_30"] = 0
        result["evidence_sales_90"] = 0
        result["evidence_median_text"] = "Aucune"
        result["evidence_decision"] = "🟠 Aucune preuve marché"
        result["evidence_action"] = "Aucune référence exploitable"
        result["score_before_evidence_gate"] = None
        return result

    evidence = market_evidence.compute_market_evidence(ref.get("catalog_name"))

    median = evidence.get("median_sold_chf")
    median_text = f"{median} CHF" if median is not None else "Aucune"

    result["market_evidence"] = evidence
    result["evidence_score"] = evidence.get("evidence_score", 0)
    result["evidence_sales_30"] = evidence.get("sales_30_count", 0)
    result["evidence_sales_90"] = evidence.get("sales_90_count", 0)
    result["evidence_median_text"] = median_text
    result["evidence_decision"] = evidence.get("evidence_decision")
    result["evidence_action"] = evidence.get("evidence_action")
    result["score_before_evidence_gate"] = None

    is_candidate_deal = (
        result.get("direction") != "REJECTED"
        and result.get("score", 0) >= DEAL_ALERT_MIN_SCORE
    )

    evidence_too_weak = (
        result.get("evidence_score", 0) < MIN_MARKET_EVIDENCE_FOR_SOLID_DEAL
    )

    if REQUIRE_MARKET_EVIDENCE_FOR_SOLID_DEAL == 1 and is_candidate_deal and evidence_too_weak:
        result["score_before_evidence_gate"] = result.get("score", 0)
        result["score"] = min(result.get("score", 0), 70)
        result["flip_decision"] = "🟡 FLIP À VÉRIFIER"
        result["verdict"] = "🟡 Prix intéressant mais ventes réelles insuffisantes"

        old_reason = result.get("reason") or ""
        extra_reason = "preuve marché insuffisante / ventes réelles manquantes"
        result["reason"] = f"{old_reason} / {extra_reason}" if old_reason else extra_reason

        result["action_recommended"] = (
            "Prix potentiellement intéressant, mais pas assez de ventes réelles renseignées. "
            "Ne pas acheter automatiquement. Vérifier eBay sold / Cardmarket / ventes récentes puis ajouter les ventes dans sales_comps.csv."
        )

    return result

def proximity_sort_key(item):
    market_score = item.get("market_score", 0)
    seller_score = item.get("seller_confidence_score", 0)
    flip_score = item.get("score", 0)
    gap = item.get("gap_to_target")

    if gap is None:
        gap = 999999

    if gap < 0:
        gap = 0

    return (-market_score, -seller_score, gap, -flip_score)


# =========================
# MAIN
# =========================

def main():
    references = []
    errors = []

    for config in CATALOG:
        try:
            found = pricecharting_search(config)
            references.extend(found)
            time.sleep(PRICECHARTING_SLEEP_SECONDS)
        except Exception as e:
            errors.append(f"PriceCharting {config['name']} : {e}")

    refs = reference_by_catalog(references)

    internal_refs_added = 0
    for config in CATALOG:
        if config["name"] not in refs:
            fallback = build_internal_reference(config)
            if fallback:
                references.append(fallback)
                refs[config["name"]] = fallback
                internal_refs_added += 1

    offers = []
    source_status = []

    if SERPAPI_API_KEY:
        before = len(offers)

        for config in CATALOG:
            offers.extend(serpapi_google_shopping_offers(config))

        source_status.append(f"Google Shopping / SerpApi : {len(offers) - before} offres")
    else:
        source_status.append("Google Shopping / SerpApi : désactivé, secret SERPAPI_API_KEY manquant")

    ebay_token = ebay_get_token()

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
    rejected = []

    for offer in offers:
    ref = refs.get(offer.get("catalog_name"))
    result = evaluate_offer(offer, ref)
    result = attach_market_evidence(result)

    if result["direction"] == "REJECTED":
        rejected.append(result)
    else:
        evaluated.append(result)


    evaluated = sorted(evaluated, key=proximity_sort_key)
    rejected = sorted(rejected, key=lambda x: x["offer"].get("price_chf", 999999))
    references = sorted(references, key=lambda x: x["score"], reverse=True)

    good_deals = [
        x for x in evaluated
        if x["score"] >= DEAL_ALERT_MIN_SCORE
        and x["seller_confidence_score"] >= MIN_SELLER_CONFIDENCE_FOR_AUTO_DEAL
    ]

    watch_deals = [
        x for x in evaluated
        if x not in good_deals
        and (
            x["score"] >= WATCH_MIN_SCORE
            or x["market_score"] >= MARKET_WATCH_MIN_SCORE
        )
    ]

    near_misses = [
        x for x in evaluated
        if x not in good_deals and x not in watch_deals
    ]

    export_deals = [x for x in good_deals if x["direction"] == "EXPORT_CH"]
    import_deals = [x for x in good_deals if x["direction"] == "IMPORT_TO_CH"]
    market_ok = [x for x in evaluated if x["market_score"] >= MARKET_WATCH_MIN_SCORE]
    low_seller_watch = [x for x in watch_deals if x["seller_confidence_score"] < MIN_SELLER_CONFIDENCE_FOR_AUTO_DEAL]

    send_telegram(
        f"""🔎 DEAL HUNTER AI — UNIVERSAL DEAL ENGINE V6.10

Statut :
Moteur multi-sources activé avec confiance vendeur.

Améliorations V6.10 :
Score confiance vendeur ajouté.
Risque vendeur / plateforme ajouté.
Action recommandée ajoutée.
eBay inconnu = achat manuel obligatoire.
Les prix marché corrects sont séparés des vrais deals flip.
Messages Telegram réduits.

Sources :
{chr(10).join(source_status)}

Références marché totales :
{len(references)}

Références internes ajoutées :
{internal_refs_added}

Offres achetables détectées :
{len(offers)}

Offres analysées :
{len(evaluated)}

Offres rejetées :
{len(rejected)}

Deals solides flip :
{len(good_deals)}

À surveiller / prix marché correct :
{len(watch_deals)}

Prix marché corrects :
{len(market_ok)}

Alertes avec vendeur faible :
{len(low_seller_watch)}

Pistes non retenues :
{len(near_misses)}

Export Suisse → étranger :
{len(export_deals)}

Import étranger → Suisse :
{len(import_deals)}

Pays SerpApi :
{", ".join(SERPAPI_COUNTRIES)}

Seuil alerte flip :
{DEAL_ALERT_MIN_SCORE}/100

Seuil confiance vendeur auto :
{MIN_SELLER_CONFIDENCE_FOR_AUTO_DEAL}/100

Profit minimal flip voulu :
{MIN_PROFIT_CHF} CHF

Conversions :
USD {USD_TO_CHF} / EUR {EUR_TO_CHF} / GBP {GBP_TO_CHF} / JPY {JPY_TO_CHF}

Heure :
{datetime.utcnow().isoformat()} UTC
"""
    )

    if errors:
        send_telegram("⚠️ Erreurs PriceCharting\n\n" + "\n".join(errors[:10]))

    if good_deals:
        for item in good_deals[:MAX_DEAL_MESSAGES]:
            offer = item["offer"]
            ref = item["reference"]

            send_telegram(
                f"""🚨 DEAL HUNTER AI — DEAL FLIP SOLIDE

Décision flip :
{item['flip_decision']}

Décision marché :
{item['market_decision']}

Confiance vendeur :
{item['seller_confidence_label']} — {item['seller_confidence_score']}/100

Risque vendeur :
{item['seller_risk']}

Action recommandée :
{item['action_recommended']}

Offre :
{offer.get('title')}

Prix actuel :
{offer.get('price_chf')} CHF

Prix max flip :
{item.get('target_buy_price')} CHF

Écart flip :
{item.get('gap_text')}

Prix marché effectif :
{item.get('market_effective_price')} CHF

Fourchette marché :
{item.get('market_range_text')}

Source :
{offer.get('source')}

Pays vendeur :
{offer.get('seller_country')}

Référence :
{ref.get('catalog_name')}

Source référence :
{ref.get('reference_source')}

Profit flip estimé :
{item['profit']} CHF

ROI flip :
{item['roi']} %

Lien :
{offer.get('url')}
"""
            )
    else:
        send_telegram(
            "⚪ Aucun deal flip solide détecté. Le bot affiche les prix marché corrects et la confiance vendeur."
        )

    if watch_deals:
        lines = []

        for item in watch_deals[:MAX_WATCH_MESSAGES]:
            offer = item["offer"]
            ref = item["reference"]

            lines.append(
                f"""— {offer.get('title')}
Décision flip : {item['flip_decision']}
Décision marché : {item['market_decision']}
Confiance vendeur : {item['seller_confidence_label']} — {item['seller_confidence_score']}/100
Risque : {item['seller_risk']}
Action : {item['action_recommended']}
Prix actuel : {offer.get('price_chf')} CHF
Prix max flip : {item.get('target_buy_price')} CHF
Écart flip : {item.get('gap_text')}
Prix marché effectif : {item.get('market_effective_price')} CHF
Fourchette marché : {item.get('market_range_text')}
Source : {offer.get('source')}
Pays vendeur : {offer.get('seller_country')}
Référence : {ref.get('catalog_name')}
Source référence : {ref.get('reference_source')}
Profit flip estimé : {item['profit']} CHF
ROI flip : {item['roi']} %
Lien : {offer.get('url')}
"""
            )

        send_telegram(
            "🟡 DEAL HUNTER AI — À SURVEILLER / PRIX MARCHÉ / CONFIANCE VENDEUR\n\n"
            + "\n".join(lines)
        )

    if near_misses:
        lines = []

        for item in near_misses[:MAX_NEAR_MISS_MESSAGES]:
            offer = item["offer"]
            ref = item["reference"]
            reason = item.get("reason") or "Score trop faible / marge insuffisante"

            lines.append(
                f"""— {offer.get('title')}
Décision flip : {item['flip_decision']}
Décision marché : {item['market_decision']}
Confiance vendeur : {item['seller_confidence_label']} — {item['seller_confidence_score']}/100
Prix actuel : {offer.get('price_chf')} CHF
Prix marché effectif : {item.get('market_effective_price')} CHF
Fourchette marché : {item.get('market_range_text')}
Source : {offer.get('source')}
Pays vendeur : {offer.get('seller_country')}
Référence : {ref.get('catalog_name')}
Pourquoi non retenu :
{reason}
Lien : {offer.get('url')}
"""
            )

        send_telegram(
            "🔍 DEAL HUNTER AI — MEILLEURES PISTES NON RETENUES\n\n"
            + "\n".join(lines)
        )

    if rejected:
        lines = []
        for item in rejected[:MAX_REJECTED_MESSAGES]:
            offer = item["offer"]
            lines.append(
                f"""— {offer.get('title')}
Prix : {offer.get('price_chf')} CHF
Source : {offer.get('source')}
Pays vendeur : {offer.get('seller_country')}
Confiance vendeur : {item.get('seller_confidence_label')} — {item.get('seller_confidence_score')}/100
Décision : {item.get('flip_decision')}
Raison : {item.get('reason') or item.get('verdict')}
"""
            )

        send_telegram(
            "🧹 DEAL HUNTER AI — OFFRES REJETÉES LES PLUS PROCHES\n\n"
            + "\n".join(lines)
        )

    for ref in references[:MAX_REFERENCE_MESSAGES]:
        swiss = ref.get("swiss_range")
        swiss_text = f"{swiss[0]}–{swiss[1]} CHF" if swiss else "Non calibré"

        send_telegram(
            f"""📊 DEAL HUNTER AI — RÉFÉRENCE MARCHÉ

Produit :
{ref.get('catalog_name')}

Source référence :
{ref.get('reference_source')}

Confiance :
{ref.get('confidence')}

Score référence :
{ref.get('score')}/100

Prix référence :
{ref.get('main_chf')} CHF
≈ {ref.get('main_usd')} USD

Marché suisse estimé :
{swiss_text}

Lecture :
{reference_market_note(ref)}

Lien référence :
{ref.get('url')}
"""
        )


if __name__ == "__main__":
    main()