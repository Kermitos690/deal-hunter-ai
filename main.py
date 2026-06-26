import os
import requests
from datetime import datetime

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

def send_telegram(message: str):
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        print("❌ Telegram secrets missing")
        return

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"

    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": message,
        "disable_web_page_preview": False
    }

    response = requests.post(url, json=payload, timeout=20)
    print("Telegram status:", response.status_code)
    print(response.text)

def main():
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")

    message = f"""✅ DEAL HUNTER AI — TEST GITHUB

Le robot tourne correctement depuis GitHub Actions.

Heure du test :
{now}

Statut :
Infrastructure OK.
Secrets Telegram OK.
Prochaine étape : ajouter la recherche automatique d'annonces."""

    print("🚀 Deal Hunter AI started")
    send_telegram(message)
    print("✅ Deal Hunter AI finished")

if __name__ == "__main__":
    main()
