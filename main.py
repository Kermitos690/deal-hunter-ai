import os, re, requests, urllib.parse
from bs4 import BeautifulSoup
from datetime import datetime

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

QUERIES = [
    "site:ricardo.ch/fr pokemon scellé",
    "site:ricardo.ch/fr pokemon display scellé",
    "site:ricardo.ch/fr pokemon booster box",
    "site:ricardo.ch/fr pokemon etb scellé",
    "site:ricardo.ch/fr pokemon japonais",
    "site:ricardo.ch/fr pokemon psa 10",
    "site:ricardo.ch/fr topps chrome",
    "site:ricardo.ch/fr panini prizm",
]

BAD = ["vendu", "terminé", "expiré", "supprimé", "nicht", "deutsch", "sticker", "album", "adrenalyn", "match attax"]
ACTIVE = ["acheter", "enchérir", "faire une offre", "prix", "chf", "livraison", "vendeur"]

def send(msg):
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    requests.post(url, json={"chat_id": TELEGRAM_CHAT_ID, "text": msg[:3900]}, timeout=20)

def clean_duck_url(href):
    if "uddg=" in href:
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(href).query)
        return urllib.parse.unquote(qs.get("uddg", [""])[0])
    return href

def search_duck(q):
    url = "https://html.duckduckgo.com/html/?q=" + urllib.parse.quote(q)
    r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=25)
    soup = BeautifulSoup(r.text, "html.parser")
    out = []
    for a in soup.select("a.result__a")[:10]:
        link = clean_duck_url(a.get("href", ""))
        title = a.get_text(" ", strip=True)
        if "ricardo.ch" in link:
            out.append((title, link))
    return out

def search_bing(q):
    url = "https://www.bing.com/search?q=" + urllib.parse.quote(q)
    r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=25)
    soup = BeautifulSoup(r.text, "html.parser")
    out = []
    for a in soup.select("li.b_algo h2 a")[:10]:
        link = a.get("href", "")
        title = a.get_text(" ", strip=True)
        if "ricardo.ch" in link:
            out.append((title, link))
    return out

def verify_active(url):
    try:
        r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=25)
        text = r.text.lower()

        if r.status_code == 403 or "captcha" in text:
            return False, "Bloqué par CAPTCHA Ricardo"

        if any(x in text for x in BAD):
            return False, "Annonce probablement inactive / mauvaise"

        if any(x in text for x in ACTIVE):
            return True, "Annonce active confirmée"

        return False, "Actif non confirmé"
    except Exception as e:
        return False, str(e)

def score(title):
    t = title.lower()
    s = 50
    for w in ["scellé", "scelle", "display", "booster box", "etb", "japonais", "psa 10", "topps chrome", "prizm"]:
        if w in t:
            s += 8
    for b in BAD:
        if b in t:
            s -= 50
    return max(0, min(100, s))

def main():
    print("Deal Hunter AI Ricardo active test", datetime.utcnow().isoformat())

    candidates = []
    for q in QUERIES:
        print("Query:", q)
        try:
            candidates += search_duck(q)
            candidates += search_bing(q)
        except Exception as e:
            print("Search error:", e)

    seen = set()
    active = []

    for title, link in candidates:
        if link in seen:
            continue
        seen.add(link)

        ok, reason = verify_active(link)
        print(title, link, ok, reason)

        if ok:
            active.append((title, link, score(title), reason))

    send(f"""🔎 DEAL HUNTER AI — RICARDO TEST

Candidats trouvés :
{len(seen)}

Annonces actives confirmées :
{len(active)}

Filtre :
Uniquement annonces Ricardo actives confirmées.
""")

    for title, link, s, reason in sorted(active, key=lambda x: x[2], reverse=True)[:5]:
        send(f"""🚨 RICARDO ACTIF

Score :
{s}/100

Produit :
{title}

Statut :
{reason}

Lien :
{link}

À vérifier :
prix, scellage, vendeur, frais, liquidité.""")
        
if __name__ == "__main__":
    main()