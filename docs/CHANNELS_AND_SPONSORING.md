# Deal Hunter AI — canaux et placements sponsorisés

## Objectif

Les canaux regroupent des opportunités et contenus éditoriaux par spécialité sans révéler le radar, l’utilisateur ou les critères privés à l’origine d’un deal.

Canaux initiaux :

- Pokémon — toutes les opportunités ;
- Pokémon — sorties 2025–2026 ;
- Pokémon — cartes gradées ;
- Pokémon — produits scellés ;
- Pokémon — vintage ;
- Pokémon — lots pour boutiques ;
- Montres — opportunités.

## Publication

La première version utilise une publication éditoriale administrateur. Les opportunités ne sont pas automatiquement copiées depuis les radars privés.

Le moteur contient toutefois des règles testées de compatibilité par canal. Une automatisation ultérieure devra respecter au minimum :

- score de 55 ou plus ;
- marge nette estimée de 25 CHF ou plus ;
- recommandation différente de `AVOID` ;
- suppression de toute référence à l’utilisateur et au radar ;
- publication d’un même produit une seule fois par canal.

## Abonnements

Un utilisateur peut suivre un canal avec l’un des modes suivants :

- dashboard ;
- Telegram ;
- dashboard et Telegram ;
- suivi sans notification.

La première interface affiche les flux dans le dashboard. Le mode Telegram est conservé dans le modèle pour une activation ultérieure contrôlée.

## Sponsoring

Une publicité est une entité séparée d’un `channel_post` et d’un `deal_score`.

Règles impératives :

- label visible `Sponsorisé` ;
- nom de l’annonceur ;
- lien sortant avec `rel="sponsored nofollow"` ;
- aucune modification du score, du classement, de la marge ou de la recommandation ;
- ciblage uniquement par canal ou catégorie ;
- aucune utilisation du contenu privé d’un radar ou d’une conversation ;
- date de début et de fin ;
- plafonds facultatifs d’impressions et de clics ;
- fréquence quotidienne par utilisateur ;
- approbation administrateur distincte de la création ;
- suivi séparé des impressions et clics.

Par défaut, les placements sont visibles uniquement sur les comptes Free. Les plans Pro et Business restent sans publicité sauf activation explicite de `SPONSORED_ON_PAID_PLANS=true`.

## États d’une campagne

- `draft` : créée mais invisible ;
- `approved` : validée et diffusable selon ses dates ;
- `active` : en diffusion ;
- `paused` : suspendue ;
- `ended` : terminée ;
- `rejected` : refusée.

## Activation

1. Appliquer `20260713235500_channels_and_sponsored_placements.sql` dans Supabase.
2. Vérifier les tables, fonctions et RLS.
3. Déployer le code.
4. Ajouter dans Vercel :
   - `ENABLE_CHANNELS=true` ;
   - `ENABLE_SPONSORED_PLACEMENTS=false` pour ouvrir les canaux sans publicité ;
   - activer ensuite `ENABLE_SPONSORED_PLACEMENTS=true` après création et validation d’une campagne test ;
   - conserver `SPONSORED_ON_PAID_PLANS=false`.
5. Ouvrir `/admin/channels` avec le compte administrateur principal.
6. Publier un contenu éditorial test.
7. Créer une campagne test, l’approuver puis l’activer.
8. Vérifier l’affichage `Sponsorisé`, la fréquence quotidienne, le clic et les compteurs.

## Sécurité de déploiement

Tant que `ENABLE_CHANNELS=false`, les pages restent masquées et aucune table ou fonction nouvelle n’est appelée depuis les parcours existants.

Tant que `ENABLE_SPONSORED_PLACEMENTS=false`, aucune campagne n’est sélectionnée et aucun compteur n’est écrit.

## Modèle commercial suggéré

Pour une bêta TCG :

- sponsor principal d’un canal ;
- mise en avant limitée d’une boutique physique ;
- campagne de précommande d’une extension ;
- service de grading ou d’authentification ;
- fournitures professionnelles : sleeves, classeurs, vitrines, stockage ;
- événements ou tournois locaux.

Une publicité ne doit jamais être présentée comme une opportunité détectée par Deal Hunter AI.
