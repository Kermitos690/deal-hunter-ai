# Import administrateur de ventes conclues

Endpoint : `POST /api/admin/market-comparables/import`.

Le corps JSON contient `comparables`, avec au maximum 1000 lignes. Les champs
obligatoires sont `source`, `externalId`, `title`, `category`, `soldPrice`,
`currency`, `soldAt` et `evidenceUrl`. Utiliser `manual_verified` uniquement
lorsque la vente et son prix sont vérifiables.

Le fichier `market-comparables-template.csv` définit le format de collecte. Le
CSV doit être transformé en JSON avant l’appel de l’endpoint dans cette version.
Une même paire `source + externalId` met à jour la vente existante et ne crée pas
de doublon.

Les devises non CHF sont conservées telles quelles. Elles ne participent à une
estimation CHF qu’après conversion/import en CHF ; ne jamais modifier un prix
sans conserver la devise et le prix d’origine dans les notes ou `rawPayload`.
