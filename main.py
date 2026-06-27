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
    url = "https://order.mandarake.co.jp/order/listPage/list"
    params = {"keyword": "pokemon", "lang": "en"}

    r = requests.get(
        url,
        params=params,
        headers={"User-Agent": "Mozilla/5.0"},
        timeout=30
    )

    html = r.text
    soup = BeautifulSoup(html, "html.parser")

    title = soup.title.get_text(strip=True) if soup.title else "Aucun title"

    scripts = []
    for s in soup.find_all("script"):
        src = s.get("src", "")
        if src:
            scripts.append(src)

    possible_endpoints = sorted(set(re.findall(r'https?://[^"\']+|/[A-Za-z0-9_\-/]+(?:api|json|search|list|item|product)[^"\']*', html)))

    send(f"""🔧 DEBUG MANDARAKE PROFOND

Heure :
{datetime.utcnow().isoformat()} UTC

Status :
{r.status_code}

Taille HTML :
{len(html)}

Titre page :
{title}

Nombre scripts :
{len(scripts)}

Nombre endpoints possibles :
{len(possible_endpoints)}
""")

    send("📄 PREVIEW HTML\n\n" + html[:2500])

    if scripts:
        send("📜 SCRIPTS TROUVÉS\n\n" + "\n".join(scripts[:30]))

    if possible_endpoints:
        send("🔗 ENDPOINTS POSSIBLES\n\n" + "\n".join(possible_endpoints[:40]))
    else:
        send("⚠️ Aucun endpoint évident trouvé dans le HTML.")

if __name__ == "__main__":
    main()