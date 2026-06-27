import os
import requests
from bs4 import BeautifulSoup
from datetime import datetime

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

def send(msg):
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    requests.post(url, json={"chat_id": TELEGRAM_CHAT_ID, "text": msg[:3900]}, timeout=20)

url = "https://order.mandarake.co.jp/rss/"

r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)

soup = BeautifulSoup(r.text, "xml")

items = []
for item in soup.find_all("item")[:50]:
    title = item.find("title").get_text(strip=True) if item.find("title") else ""
    link = item.find("link").get_text(strip=True) if item.find("link") else ""
    desc = item.find("description").get_text(" ", strip=True) if item.find("description") else ""

    text = f"{title} {desc}".lower()

    if "pokemon" in text or "ポケモン" in text or "pocket monster" in text:
        items.append((title, link, desc[:300]))

send(f"""🔎 MANDARAKE RSS TEST V2

Status :
{r.status_code}

Taille :
{len(r.text)}

Items RSS :
{len(soup.find_all("item"))}

Produits Pokémon trouvés :
{len(items)}

Heure :
{datetime.utcnow().isoformat()} UTC
""")

if not items:
    send("⚠️ Aucun produit Pokémon trouvé dans le RSS Mandarake sur ce passage.")
else:
    for title, link, desc in items[:10]:
        send(f"""🧩 MANDARAKE RSS ITEM

Titre :
{title}

Lien :
{link}

Description :
{desc}
""")