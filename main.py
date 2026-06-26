import requests

url = "https://www.ricardo.ch/fr/s/pokemon"

headers = {
    "User-Agent": "Mozilla/5.0"
}

r = requests.get(url, headers=headers, timeout=20)

print("STATUS:", r.status_code)
print("LENGTH:", len(r.text))
print(r.text[:500])