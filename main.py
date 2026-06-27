import os
import requests
import xml.etree.ElementTree as ET
from datetime import datetime

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

def send(msg):
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    requests.post(url, json={"chat_id": TELEGRAM_CHAT_ID, "text": msg[:3900]}, timeout=20)

url = "https://order.mandarake.co.jp/rss/"

r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)

items = []
root = ET.fromstring(r.text)

for item in root.findall(".//item")[:20]:
    title = item.findtext("title") or ""
    link = item.findtext("link") or ""
    desc = item.findtext("description") or ""

    text = f"{title} {desc}".lower()

    if "pokemon" in text or "ポケモン" in text or "pocket monster" in text:
        items.append((title, link, desc[:300]))

send(f"""🔎 MANDARAKE RSS TEST

Status :
{r.status_code}

Taille :
{len(r.text)}

Produits Pokémon trouvés :
{len(items)}

Heure :
{datetime.utcnow().isoformat()} UTC
""")

for title, link, desc in items[:10]:
    send(f"""🧩 MANDARAKE RSS ITEM

Titre :
{title}

Lien :
{link}

Description :
{desc}
""")