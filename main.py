import requests

headers = {
    "User-Agent": "Mozilla/5.0"
}

url = "https://www.cardmarket.com/fr/Pokemon/Products/Search?idCategory=0&searchString=pokemon+booster+box"

print("Connexion Cardmarket...")

r = requests.get(url, headers=headers, timeout=30)

print("STATUS:", r.status_code)
print("LENGTH:", len(r.text))
print(r.text[:1000])