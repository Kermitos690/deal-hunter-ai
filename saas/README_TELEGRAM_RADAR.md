# README — Telegram Radar

## Périmètre

Le bot Telegram Deal Hunter AI sert à créer des radars, scanner les sources connectées, recevoir des alertes deals et ouvrir le dashboard Deal Hunter.

Il ne gère pas de marketplace vendeur, boutique vendeur, Wallet Pay, PayPal manual, Shop Trust Token ou onboarding vendeur.

## Commandes disponibles

- `/start` : ouvrir le menu principal.
- `/menu` : ouvrir le menu principal.
- `/newradar` : créer un radar.
- `/radars` : lister les radars et lancer un scan manuel.
- `/alerts` : afficher les dernières alertes.
- `/inbox` : ouvrir l'inbox de tri avec les deals à traiter, gardés et rejetés.
- `/deals` : afficher les meilleures opportunités.
- `/status` : afficher l'état du compte.
- `/settings` : ouvrir le dashboard avec un lien signé.
- `/language` : choisir la langue du bot.
- `/stop` : suspendre les alertes.
- `/resume` : réactiver les alertes.
- `/help` : afficher l'aide.

## Langues

Le bot supporte une base multilingue pour les points d'entrée Telegram :

- français ;
- anglais ;
- allemand ;
- italien.

La langue peut être choisie avec `/language`. La préférence est stockée dans `users.preferred_language`.

Si Yandex Translate est configuré, les textes dynamiques du tri Telegram peuvent être traduits automatiquement selon la langue de l'utilisateur.

Variables requises :

- `YANDEX_TRANSLATE_API_KEY`
- `YANDEX_TRANSLATE_FOLDER_ID`

Si ces variables sont absentes ou si l'API échoue, le bot conserve le texte français sans bloquer le flux utilisateur.

Le français reste le fallback. Les textes métier profonds comme les analyses complètes, le scoring détaillé et certaines pages dashboard doivent être traduits progressivement dans la phase V2 Premium pour éviter une régression massive.

## Flow création radar

1. L'utilisateur ouvre `/menu`.
2. Il clique `Créer un radar`.
3. Il choisit une catégorie.
4. Il choisit une proposition ou écrit une recherche libre.
5. Il indique un budget.
6. Il choisit les états acceptés.
7. Il coche les sources à scanner.
8. Il indique une marge minimum.
9. Il choisit la fréquence.
10. Le radar est créé et un scan immédiat est lancé quand possible.

## Réception des résultats

Par défaut, le bot ne doit plus bombarder l'utilisateur avec une alerte Telegram par opportunité. Le mode standard est :

1. les opportunités sont créées en base ;
2. elles sont rangées dans l'inbox de l'utilisateur ;
3. Telegram envoie un résumé de scan ;
4. l'utilisateur trie ensuite avec `Garder`, `Jeter` ou `Deal suivant`.

Variables de contrôle :

- `TELEGRAM_ALERT_DELIVERY_MODE=digest` : mode recommandé, résumé + inbox.
- `TELEGRAM_ALERT_DELIVERY_MODE=individual` : ancien mode, une alerte Telegram par deal.
- `TELEGRAM_MAX_IMMEDIATE_ALERTS_PER_SCAN=0` : nombre maximum d'alertes immédiates avant résumé. Par défaut `0`.

Le bouton `Jeter` doit empêcher le même produit ou un doublon probable de revenir dans les prochains scans du même utilisateur.

## Canaux de diffusion Telegram

Un bot Telegram ne peut pas créer seul des canaux de diffusion côté utilisateur. Pour router certains résumés vers un canal, il faut :

1. créer manuellement le canal Telegram ;
2. ajouter le bot comme administrateur du canal ;
3. enregistrer l'identifiant du canal côté application ;
4. envoyer uniquement des résumés ou sélections validées, pas le flux brut complet.

À ce stade, l'inbox Telegram est la source officielle de tri. Les canaux doivent rester optionnels pour éviter de recréer le problème de surcharge de messages.

## Sources recommandées

Le pack recommandé active :

- `ebay`
- `komehyo`
- `tutti`
- `email-alerts`

Ces sources sont les plus adaptées à une bêta privée gratuite ou peu coûteuse.

## Sources bêta

- `ricardo`
- `anibis`

Ces sources restent accessibles dans Telegram mais ne sont pas cochées par défaut. Elles peuvent être instables à cause des protections anti-bot, restrictions réseau ou changements HTML.

Si une source échoue, le bot doit expliquer que la source est temporairement instable et que le radar continue avec les autres sources disponibles.

## Callbacks expirés

Si un utilisateur clique un vieux bouton de création radar, le bot doit répondre clairement :

> Ce bouton a expiré. Recommence la création du radar pour éviter une mauvaise configuration.

Un bouton `Recommencer le radar` doit être proposé quand pertinent.

## Dashboard

Les boutons Dashboard utilisent `APP_BASE_URL` et génèrent un lien signé temporaire via Telegram. En production, `APP_BASE_URL` doit pointer vers :

```text
https://deal-hunter-ai.vercel.app
```

Le lien ne doit jamais pointer vers `localhost`.

## Republish des commandes Telegram

Après ajout ou changement de commande :

```bash
curl -sS "https://deal-hunter-ai.vercel.app/api/telegram/setup?secret=<SETUP_SECRET>"
```

Réponse attendue :

```json
{"ok":true,"commands":true,"webhook":true}
```

## Webhook

Endpoint :

```text
POST /api/telegram/webhook
```

Règles :

- signature `x-telegram-bot-api-secret-token` obligatoire ;
- payload invalide : `400`;
- update sans `update_id` : `400`;
- update valide sans `message` ni `callback_query` : `200 ignored`;
- update déjà traité : `200 duplicate`;
- aucun secret ne doit être loggé.

## Procédure QA production

Tester dans Telegram :

1. `/start`
2. `/menu`
3. `/help`
4. `/status`
5. `Créer un radar`
6. vérifier les sources précochées : eBay, Komehyo, Tutti, Email alerts
7. vérifier Ricardo/Anibis marqués bêta
8. décocher/recocher une source
9. continuer et terminer le radar
10. vérifier `Mes radars`
11. lancer `Scanner`
12. tester les boutons deal : Sauvegarder, Rejeter, Négocier, Analyse complète
13. ouvrir `/inbox`
14. tester `Deal suivant`, `Garder`, `Jeter`, `Top deals`
15. ouvrir Dashboard

Critères d'acceptation :

- aucune réponse 500 ;
- aucun bouton silencieux ;
- aucun secret affiché ;
- textes compréhensibles pour un utilisateur non technique ;
- les actions répétées ne créent pas de doublon critique ;
- un deal rejeté ou son doublon probable ne revient pas dans l'inbox de l'utilisateur.
