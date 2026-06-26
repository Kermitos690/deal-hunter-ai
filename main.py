import os
import requests

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

def send(msg):
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    requests.post(url, json={"chat_id": TELEGRAM_CHAT_ID, "text": msg[:3900]}, timeout=20)

headers = {"User-Agent": "Mozilla/5.0"}

SOURCES = {
    "Suruga-ya JP": "https://www.suruga-ya.jp/search?category=&search_word=pokemon%20booster%20box",
    "Mandarake JP": "https://order.mandarake.co.jp/order/listPage/list?keyword=pokemon%20booster%20box&lang=en",
    "Rakuten JP": "https://search.rakuten.co.jp/search/mall/pokemon+booster+box/",
    "PriceCharting": "https://www.pricecharting.com/search-products?q=pokemon+booster+box&type=prices",
    "TCGplayer": "https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q=booster%20box",
}

results = []

for name, url in SOURCES.items():
    try:
        r = requests.get(url, headers=headers, timeout=30)
        text = r.text.lower()

        blocked = (
            r.status_code in [403, 429, 503]
            or "cloudflare" in text
            or "captcha" in text
            or "attention required" in text
        )

        results.append(f"""Source : {name}
Status : {r.status_code}
Length : {len(r.text)}
Bloqué : {"OUI" if blocked else "NON"}
URL : {url}
""")
    except Exception as e:
        results.append(f"""Source : {name}
ERREUR : {e}
""")

message = "🔎 DEAL HUNTER AI — TEST SOURCES\n\n" + "\n---\n".join(results)
print(message)
send(message)