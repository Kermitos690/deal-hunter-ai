# Deal Hunter AI — verticale Pokémon / Trading Cards

## Objectif bêta

Cette verticale cible en priorité les collectionneurs, acheteurs professionnels et boutiques physiques qui recherchent des cartes Pokémon à l’unité, des cartes gradées, des produits scellés et des lots à trier.

Elle complète les catégories historiques de Deal Hunter AI sans modifier leur comportement.

## Produits reconnus

- cartes non gradées (`RAW_SINGLE`) ;
- cartes gradées / slabs (`GRADED_CARD`) ;
- produits scellés (`SEALED_PRODUCT`) ;
- lots, collections et classeurs (`LOT_COLLECTION`) ;
- accessoires, uniquement lorsqu’ils sont explicitement demandés.

## Données extraites

Le moteur tente de déterminer :

- set ou extension ;
- numéro de carte ;
- rareté ;
- langue ;
- année de sortie ;
- société de grading ;
- grade ;
- numéro de certification lorsqu’il est présent ;
- état raw : NM, LP, MP, HP ou DMG ;
- première édition ;
- holo, reverse holo et promo ;
- produit scellé ;
- signaux de contrefaçon ou de produit non officiel.

## Grading pris en charge

- PSA ;
- BGS / Beckett ;
- CGC ;
- SGC ;
- ACE ;
- PCA.

## Langues

- français ;
- anglais ;
- allemand ;
- italien ;
- espagnol ;
- japonais ;
- coréen ;
- chinois.

## Sorties 2025–2026 mises en avant

Le catalogue intégré reconnaît notamment :

- Prismatic Evolutions ;
- Journey Together ;
- Destined Rivals ;
- Black Bolt ;
- White Flare ;
- Mega Evolution ;
- Phantasmal Flames ;
- Ascended Heroes ;
- Perfect Order ;
- Chaos Rising ;
- Pitch Black.

La mention d’une sortie récente ajoute un avertissement de volatilité. Elle ne crée jamais automatiquement une recommandation d’achat.

## Radars proposés

- Pokémon — sorties 2025–2026 ;
- Pokémon gradées PSA/BGS/CGC ;
- Pokémon scellé ;
- Pokémon vintage raw ;
- Pokémon lots pour boutique.

## Recherche large multi-source

Les paramètres spécialisés sont encodés dans les radars existants sous forme de directives internes `tcg:`. Ces directives ne sont pas envoyées telles quelles aux marketplaces.

Le moteur les transforme en requêtes lisibles adaptées aux sources déjà actives, notamment eBay, Ricardo, Anibis, Tutti, RSS et alertes e-mail.

Les résultats provenant de toutes les sources actives passent ensuite dans le même normaliseur Pokémon.

## Garde-fous

Sont bloqués ou fortement signalés :

- proxy ;
- replica ou fake ;
- custom card et fan art ;
- Orica ;
- cartes métal non officielles ;
- codes numériques ;
- mystery packs ;
- produits sans rapport avec Pokémon ;
- accessoires lorsqu’ils ne sont pas demandés.

Une carte gradée sans numéro de certification visible produit un avertissement. Une carte raw sans état normalisé demande une vérification recto-verso, coins, bords et surface.

## Scoring v5

Le scoring v5 ajoute une discipline de marge absolue :

- marge négative : score maximum 15 ;
- marge nette inférieure à 10 CHF : score maximum 39 ;
- marge nette inférieure à 25 CHF : score maximum 54 ;
- marge nette inférieure à 50 CHF : score maximum 69.

Cela empêche une annonce à ROI apparemment correct mais à bénéfice réel dérisoire d’obtenir un score de type « achat prioritaire ».

## Compatibilité de base de données

La première version ne requiert pas de migration Supabase. Les réglages TCG utilisent les colonnes existantes du radar et les attributs structurés sont conservés dans le payload produit existant.

Une migration dédiée pourra être ajoutée après validation bêta, lorsque les champs les plus utiles auront été confirmés avec les boutiques pilotes.
