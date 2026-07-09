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
- `/deals` : afficher les meilleures opportunités.
- `/status` : afficher l'état du compte.
- `/settings` : ouvrir le dashboard avec un lien signé.
- `/stop` : suspendre les alertes.
- `/resume` : réactiver les alertes.
- `/help` : afficher l'aide.

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
13. ouvrir Dashboard

Critères d'acceptation :

- aucune réponse 500 ;
- aucun bouton silencieux ;
- aucun secret affiché ;
- textes compréhensibles pour un utilisateur non technique ;
- les actions répétées ne créent pas de doublon critique.
