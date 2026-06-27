import os
import re
import requests
from bs4 import BeautifulSoup
from datetime import datetime

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

def send(msg):
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    requests.post(url, json={"chat_id": TELEGRAM_CHAT_ID, "text": msg[:3900]}, timeout=20)

def main():
    query = "pokemon"
    url = "https://order.mandarake.co.jp/order/listPage/list"
    params = {"keyword": query, "lang": "en"}

    r = requests.get(
        url,
        params=params,
        headers={"User-Agent": "Mozilla/5.0"},
        timeout=30
    )

    html = r.text
    soup = BeautifulSoup(html, "html.parser")

    links = []
    for a in soup.find_all("a"):
        title = a.get_text(" ", strip=True)
        href = a.get("href", "")

        if not title and not href:
            continue

        block = a.parent.get_text(" ", strip=True)[:300] if a.parent else title[:300]

        if "pokemon" in block.lower() or "pocket" in block.lower() or "card" in block.lower():
            links.append({
                "title": title[:150],
                "href": href[:200],
                "block": block
            })

    msg = f"""🔧 DEAL HUNTER AI — DEBUG MANDARAKE

Heure :
{datetime.utcnow().isoformat()} UTC

Status :
{r.status_code}

Taille HTML :
{len(html)}

Nombre de liens candidats :
{len(links)}

But :
Identifier la vraie structure HTML Mandarake pour corriger l'extracteur.
"""
    send(msg)

    if not links:
        send("⚠️ Aucun lien candidat trouvé dans le HTML Mandarake.")
        print(html[:3000])
        return

    for i, item in enumerate(links[:10], start=1):
        send(f"""🔎 CANDIDAT MANDARAKE #{i}

Titre :
{item['title']}

Lien :
{item['href']}

Bloc :
{item['block']}
""")

    print("Debug Mandarake terminé")

if __name__ == "__main__":
    main()