import os
import json
from datetime import datetime

import requests

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

TEST_DEALS = [
    {
        "source": "TEST",
        "title": "Pokemon Eevee Heroes Japanese Booster Box Sealed",
        "price": 310,
        "currency": "CHF",
        "url": "https://example.com/eevee-heroes"
    },
    {
        "source": "TEST",
        "title": "Pokemon 151 Japanese Booster Box Sealed",
        "price": 95,
        "currency": "CHF",
        "url": "https://example.com/pokemon-151-jp"
    },
    {
        "source": "TEST",
        "title": "Topps Chrome UEFA Hobby Box sealed",
        "price": 85,
        "currency": "CHF",
        "url": "https://example.com/topps-chrome"
    },
    {
        "source": "TEST",
        "title": "Pokemon stickers album lot",
        "price": 30,
        "currency": "CHF",
        "url": "https://example.com/bad-result"
    }
]

BAD_WORDS = [
    "sticker", "stickers", "album", "proxy", "fake", "custom",
    "orica", "repack", "mystery", "digital", "empty", "wrapper",
    "opened", "damaged", "match attax", "adrenalyn"
]

PREMIUM_WORDS = [
    "sealed", "scellé", "booster box", "display", "etb",
    "pokemon center", "japanese", "psa 10", "alt art", "sar",
    "eevee heroes", "evolving skies", "151", "vstar universe",
    "vmax climax", "terastal festival", "topps chrome",
    "sapphire", "hobby box", "panini prizm", "one piece", "lorcana"
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

def classify(title):
    t = title.lower()

    if "pokemon" in t:
        universe = "Pokémon"
    elif "topps" in t:
        universe = "Topps"
    elif "panini" in t:
        universe = "Panini"
    elif "one piece" in t:
        universe = "One Piece"
    elif "lorcana" in t:
        universe = "Lorcana"
    else:
        universe = "Autre"

    if "japanese" in t or "japan" in t:
        language = "Japonais"
    elif "français" in t or "francais" in t or "scellé" in t:
        language = "Français"
    else:
        language = "Anglais / international"

    if "booster box" in t or "display" in t:
        product_type = "Booster Box / Display"
    elif "etb" in t or "elite trainer" in t:
        product_type = "ETB"
    elif "psa 10" in t:
        product_type = "Carte gradée PSA 10"
    elif "hobby box" in t:
        product_type = "Hobby Box"
    else:
        product_type = "Produit à identifier"

    return universe, language, product_type

def score_deal(deal):
    title = deal["title"].lower()
    price = float(deal["price"])
    score = 40

    for bad in BAD_WORDS:
        if bad in title:
            score -= 70

    for word in PREMIUM_WORDS:
        if word in title:
            score += 6

    if "eevee heroes" in title:
        score += 20
    if "evolving skies" in title:
        score += 20
    if "151" in title and "japanese" in title:
        score += 15
    if "pokemon center" in title:
        score += 15
    if "topps chrome" in title:
        score += 12

    if "booster box" in title:
        if price < 120:
            score += 20
        elif price < 250:
            score += 10

    if "hobby box" in title and price < 120:
        score += 15

    return max(0, min(100, score))

def verdict(score):
    if score >= 90:
        return "🔥 ACHAT À VÉRIFIER IMMÉDIATEMENT"
    if score >= 80:
        return "🟢 Très intéressant"
    if score >= 70:
        return "🟡 Potentiel correct"
    if score >= 50:
        return "⚪ À surveiller"
    return "❌ À ignorer"

def main():
    now = datetime.utcnow().isoformat()

    send_telegram(f"""🧠 DEAL HUNTER AI — CERVEAU V0

Test du moteur de classification et scoring.

Heure :
{now} UTC

Nombre d'annonces testées :
{len(TEST_DEALS)}
""")

    for deal in TEST_DEALS:
        universe, language, product_type = classify(deal["title"])
        score = score_deal(deal)
        decision = verdict(score)

        if score < 50:
            continue

        message = f"""🚨 DEAL HUNTER AI — ANALYSE

Score IA :
{score}/100

Verdict :
{decision}

Univers :
{universe}

Langue :
{language}

Type :
{product_type}

Produit :
{deal["title"]}

Prix :
{deal["price"]} {deal["currency"]}

Source :
{deal["source"]}

Lien :
{deal["url"]}

Analyse :
Le robot sait maintenant classer le produit, filtrer les mauvais résultats et attribuer un score avant alerte.

Prochaine étape :
Brancher une vraie source officielle dès que les clés API eBay sont validées."""
        send_telegram(message)

    print("Deal Hunter brain test finished")

if __name__ == "__main__":
    main()