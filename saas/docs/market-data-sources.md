# Sources de données marché

Deal Hunter sépare strictement trois types de preuves :

- `SOLD` : vente réellement conclue, datée et liée à une preuve.
- `MARKET_SIGNAL` : indicateur officiel (meilleure offre, dernier prix, indice).
- `ACTIVE_LISTING` : prix demandé sur une annonce active, jamais assimilé à une vente.

## Connecteurs

| Source | Couverture | Donnée exploitable | Accès |
|---|---|---|---|
| eBay Browse | Mondiale, plusieurs marketplaces | Annonces actives | Actif |
| eBay transactions vendeur | Ventes du compte autorisé | Ventes conclues récentes | OAuth vendeur requis |
| StockX | Sneakers, montres, cartes, collectibles | Bid/ask et données marché | Validation développeur requise |
| Yahoo Shopping Japan | Japon | Annonces actives | Clé Yahoo requise |
| RSS / Atom | Selon le flux | Annonces ou ventes selon l’éditeur | Actif |
| Alertes e-mail | Selon le compte utilisateur | Données autorisées reçues par e-mail | Actif |
| Import admin | Toute plateforme/export autorisé | Ventes conclues avec date et URL | Actif |

Les plateformes sans API publique stable ne doivent pas être scrapées en contournant leurs
conditions. Elles peuvent être alimentées par un export utilisateur, un flux partenaire ou
l’endpoint `POST /api/admin/market-comparables/import`.

## Qualité de l’estimation

Les ventes récentes ont le poids le plus élevé. Le poids diminue avec l’âge, une condition
différente, une correspondance produit approximative ou une preuve peu fiable. Les annonces
actives ont un poids fortement réduit. Une confiance `HIGH` exige au moins dix ventes, cinq
ventes dans les 90 jours et deux sources indépendantes.
