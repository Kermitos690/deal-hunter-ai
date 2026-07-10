# Sources de données marché

Deal Hunter sépare strictement trois types de preuves :

- `SOLD` : vente réellement conclue, datée et liée à une preuve.
- `MARKET_SIGNAL` : indicateur officiel (meilleure offre, dernier prix, indice).
- `ACTIVE_LISTING` : prix demandé sur une annonce active, jamais assimilé à une vente.

## Connecteurs

| Source | Couverture | Donnée exploitable | Accès |
|---|---|---|---|
| eBay Browse | Mondiale, plusieurs marketplaces | Annonces actives | Actif |
| eBay Japon prioritaire | Boutiques eBay japonaises qualifiées, recherchées via eBay Browse | Annonces actives priorisées, non visibles comme source séparée | Actif |
| eBay transactions vendeur | Ventes du compte autorisé | Ventes conclues récentes | OAuth vendeur requis |
| StockX | Sneakers, montres, cartes, collectibles | Bid/ask et données marché | Validation développeur requise |
| Yahoo Shopping Japan | Japon | Annonces actives | Clé Yahoo requise |
| RSS / Atom | Selon le flux | Annonces ou ventes selon l’éditeur | Actif |
| Alertes e-mail | Selon le compte utilisateur | Données autorisées reçues par e-mail | Actif |
| Import admin | Toute plateforme/export autorisé | Ventes conclues avec date et URL | Actif |

Les plateformes sans API publique stable ne doivent pas être scrapées en contournant leurs
conditions. Elles peuvent être alimentées par un export utilisateur, un flux partenaire ou
l’endpoint `POST /api/admin/market-comparables/import`.

## Priorisation eBay Japon

La source visible reste `ebay`. Le moteur ajoute toutefois un passage interne prioritaire sur
des boutiques eBay japonaises sélectionnées, car le marché japonais de seconde main est souvent
riche en montres, sneakers et luxe d’occasion.

Boutiques prioritaires configurées par défaut :

- `https://ebay.io/m/bSMD1F` → vendeur résolu : `akiakiehgsjusov` quand eBay ne bloque pas par captcha.
- `https://ebay.io/m/TDQwZC` → vendeur résolu : `tatsuen`.
- `brandstreettokyo` → vendeur ajouté comme piste sourcing Japon publiquement citée, à surveiller.

Variables disponibles :

- `ENABLE_EBAY_PRIORITY_SOURCE=false` désactive ce passage prioritaire.
- `EBAY_PRIORITY_SOURCE_URLS` surcharge la liste des URLs boutiques.
- `EBAY_PRIORITY_SELLERS` surcharge la liste des vendeurs eBay utilisés dans le filtre `sellers`.
- `EBAY_PRIORITY_MARKETPLACES` limite les marketplaces utilisées pour le passage prioritaire.
- `EBAY_DELIVERY_COUNTRY=CH` définit le pays de livraison utilisé dans le contexte eBay.
- `EBAY_PRIORITY_JAPAN_ONLY=false` autorise les résultats prioritaires hors localisation Japon.

Important : cette priorisation ne garantit jamais l’authenticité. Elle écarte seulement les titres
qui annoncent explicitement une copie, une pièce compatible ou un composant aftermarket. Le message
produit doit continuer à demander une vérification humaine : photos, numéro de série, vendeur,
retours, garantie eBay éventuelle et cohérence du prix.

## Qualité de l’estimation

Les ventes récentes ont le poids le plus élevé. Le poids diminue avec l’âge, une condition
différente, une correspondance produit approximative ou une preuve peu fiable. Les annonces
actives ont un poids fortement réduit. Une confiance `HIGH` exige au moins dix ventes, cinq
ventes dans les 90 jours et deux sources indépendantes.
