# Deal Hunter AI — Environment Matrix

Aucune valeur réelle ne doit être ajoutée dans ce document ou commitée dans Git.

Légende :

- **Oui** : nécessaire pour cet environnement.
- **Selon fonction** : nécessaire seulement si la fonction est activée.
- **Non** : non requis.
- **Public** : peut être exposé au navigateur.
- **Secret** : serveur uniquement.

| Variable | Développement | Preview | Production | Secret ou public | Fonction associée | Comportement si absente |
|---|---|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Oui | Oui | Oui | Public | URL Supabase | Démarrage/build ou accès base impossible |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Oui | Oui | Oui | Public | Client Supabase public | Auth/client Supabase indisponible |
| `SUPABASE_SERVICE_ROLE_KEY` | Oui | Oui | Oui | **Secret** | Routes serveur et moteur | Application serveur non fonctionnelle |
| `SESSION_SECRET` | Oui | Oui | Oui | **Secret** | Sessions dashboard signées | Sessions impossibles ; minimum 32 caractères |
| `APP_BASE_URL` | Oui | Oui | Oui | Public | Liens dashboard, webhooks, Stripe | Valeur locale par défaut uniquement en développement |
| `BETA_PRIVATE_MODE` | Recommandé | Oui | Oui | Public de configuration | Marquage bêta privée | Par défaut `true` dans le schéma |
| `ADMIN_TELEGRAM_ID` | Selon fonction | Oui | Oui | Donnée privée | Autorisation administrateur | Aucun administrateur principal reconnu |
| `TELEGRAM_BOT_TOKEN` | Selon fonction | Selon fonction | Oui pour Telegram | **Secret** | API Bot Telegram | Bot, alertes et health check désactivés |
| `TELEGRAM_WEBHOOK_SECRET` | Selon fonction | Selon fonction | Oui pour Telegram | **Secret** | Signature webhook Telegram | Webhook refuse toutes les requêtes |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | Recommandé | Oui | Oui | Public | Vérification du bot attendu | `getMe` ne peut pas être comparé à un nom attendu |
| `CRON_SECRET` | Selon tests | Oui | Oui | **Secret** | Routes cron et configuration Telegram | Crons refusés ; doit être identique dans Vercel et GitHub Actions |
| `ENABLE_MOCK_SOURCE` | Selon tests | `false` | `false` | Public de configuration | Fixture contrôlée | Source mock désactivée |
| `ENABLE_EBAY_SOURCE` | Selon fonction | Selon fonction | Oui pour source réelle | Public de configuration | Source eBay | Adaptateur ignoré |
| `ENABLE_EBAY_PRIORITY_SOURCE` | Selon fonction | Selon fonction | Selon stratégie | Public de configuration | Passe eBay prioritaire | Passe prioritaire désactivée |
| `EBAY_CLIENT_ID` | Selon fonction | Selon fonction | Oui si eBay active | **Secret applicatif** | OAuth eBay | eBay marquée `misconfigured` |
| `EBAY_CLIENT_SECRET` | Selon fonction | Selon fonction | Oui si eBay active | **Secret** | OAuth eBay | eBay marquée `misconfigured` |
| `EBAY_MARKETPLACES` | Non | Recommandé | Recommandé | Public de configuration | Pays eBay interrogés | Valeur prudente par défaut |
| `EBAY_PRIORITY_SOURCE_URLS` | Non | Non | Optionnel | Public | Documentation interne vendeurs | Valeurs internes par défaut |
| `EBAY_PRIORITY_SELLERS` | Non | Non | Optionnel | Public | Filtre vendeurs prioritaires | Valeurs internes par défaut |
| `EBAY_PRIORITY_MARKETPLACES` | Non | Non | Optionnel | Public | Marchés prioritaires | Liste prudente par défaut |
| `EBAY_PRIORITY_JAPAN_ONLY` | Non | Non | Optionnel | Public | Filtre géographique prioritaire | `true` par défaut dans `.env.example` |
| `EBAY_DELIVERY_COUNTRY` | Non | Non | Recommandé | Public | Contexte de livraison eBay | `CH` par défaut |
| `EBAY_REQUEST_TIMEOUT_MS` | Non | Non | Recommandé | Public | Timeout eBay | 10 secondes par défaut |
| `EBAY_REQUEST_CONCURRENCY` | Non | Non | Recommandé | Public | Concurrence eBay | 4 par défaut |
| `EBAY_MAX_REQUESTS_PER_SCAN` | Non | Non | Recommandé | Public | Budget de requêtes eBay | 48 par défaut |
| `ENABLE_RICARDO_SOURCE` | Non | Selon test | Selon décision | Public | Collecteur Ricardo bêta | Désactivé par défaut |
| `ENABLE_ANIBIS_SOURCE` | Non | Selon test | Selon décision | Public | Collecteur Anibis bêta | Désactivé par défaut |
| `ENABLE_TUTTI_SOURCE` | Non | Selon test | Selon décision | Public | Collecteur Tutti bêta | Désactivé par défaut |
| `ENABLE_KOMEHYO_SOURCE` | Non | Selon test | Selon décision | Public | Komehyo signal marché | Désactivé par défaut |
| `LIVE_SOURCE_PROXY_URL` | Non | Selon fonction | Selon fonction | **Secret/privé** | Proxy collecteurs live | Accès direct Vercel, risque 403 |
| `SWISS_SOURCE_PROXY_URL` | Non | Selon fonction | Selon fonction | **Secret/privé** | Alias proxy suisse | Même comportement que ci-dessus |
| `LOCAL_LIVE_SCAN_LIMIT` | Non | Non | Outil local | Public | Scanner local suisse | 20 par défaut |
| `LOCAL_LIVE_SCAN_DELAY_MS` | Non | Non | Outil local | Public | Temporisation locale | 2 secondes par défaut |
| `ENABLE_YAHOO_JAPAN_SOURCE` | Non | Selon test | Selon décision | Public | Yahoo Shopping Japan | Désactivé par défaut |
| `YAHOO_JAPAN_CLIENT_ID` | Non | Selon fonction | Oui si Yahoo active | **Secret applicatif** | API Yahoo Japan | Source `misconfigured` |
| `ENABLE_RSS_SOURCE` | Selon test | Selon fonction | Selon fonction | Public | RSS/Atom | Désactivé par défaut |
| `PUBLIC_FEED_URLS` | Selon fonction | Selon fonction | Oui si RSS active | Public/privé selon flux | Liste de flux | RSS `misconfigured` |
| `ENABLE_EMAIL_ALERTS_SOURCE` | Non | Selon test | Selon fonction | Public | Source IMAP | Désactivée par défaut |
| `EMAIL_IMAP_SERVER` | Non | Selon fonction | Oui si email active | Privé | Hôte IMAP | Email `misconfigured` |
| `EMAIL_IMAP_PORT` | Non | Selon fonction | Selon fonction | Public | Port IMAP | 993 par défaut |
| `EMAIL_MAILBOX` | Non | Selon fonction | Selon fonction | Privé | Boîte IMAP | `INBOX` par défaut |
| `EMAIL_LOOKBACK_HOURS` | Non | Selon fonction | Selon fonction | Public | Fenêtre de lecture | 48 h par défaut |
| `EMAIL_MAX_MESSAGES` | Non | Selon fonction | Selon fonction | Public | Limite de lecture | 100 par défaut |
| `EMAIL_ADDRESS` | Non | Selon fonction | Oui si email active | Privé | Compte IMAP | Email `misconfigured` |
| `EMAIL_APP_PASSWORD` | Non | Selon fonction | Oui si email active | **Secret** | Authentification IMAP | Email `misconfigured` |
| `EMAIL_ALLOWED_SENDERS` | Non | Selon fonction | Recommandé | Privé | Liste blanche expéditeurs | Filtrage selon code/configuration |
| `EMAIL_ALERT_SCAN_LIMIT` | Non | Non | Recommandé | Public | Nombre de radars fast lane | 10 par défaut |
| `ENABLE_WHATSAPP` | Non | `false` sauf test | `false` pour bêta initiale | Public de configuration | Canal WhatsApp | Webhook retourne 404 et aucun envoi ne part |
| `WHATSAPP_ACCESS_TOKEN` | Non | Selon fonction | Oui si WhatsApp active | **Secret** | API Cloud Meta | Canal `misconfigured` |
| `WHATSAPP_PHONE_NUMBER_ID` | Non | Selon fonction | Oui si WhatsApp active | Privé | API Cloud Meta | Canal `misconfigured` |
| `WHATSAPP_VERIFY_TOKEN` | Non | Selon fonction | Oui si WhatsApp active | **Secret** | Challenge webhook | Vérification GET refusée |
| `WHATSAPP_APP_SECRET` | Non | Selon fonction | Oui si WhatsApp active | **Secret** | Signature HMAC POST | Tous les POST sont refusés |
| `WHATSAPP_GRAPH_VERSION` | Non | Non | Recommandé | Public | Version Graph API | `v23.0` par défaut |
| `YANDEX_TRANSLATE_API_KEY` | Non | Selon fonction | Optionnel | **Secret** | Traduction Telegram | Retour au français sans interrompre le bot |
| `YANDEX_TRANSLATE_FOLDER_ID` | Non | Selon fonction | Optionnel | Privé | Traduction Yandex | Traduction désactivée |
| `ENABLE_STRIPE` | Non | `false` ou test | `false` pour bêta privée | Public de configuration | Facturation | Checkout, portail et webhook retournent indisponible |
| `STRIPE_SECRET_KEY` | Non | Test mode uniquement | Selon activation | **Secret** | API Stripe | Stripe non configuré |
| `STRIPE_WEBHOOK_SECRET` | Non | Test mode uniquement | Selon activation | **Secret** | Signature webhook Stripe | Webhook indisponible |
| `STRIPE_PRO_PRICE_ID` | Non | Test mode uniquement | Selon activation | Privé | Plan Pro | Checkout Pro indisponible |
| `STRIPE_BUSINESS_PRICE_ID` | Non | Test mode uniquement | Selon activation | Privé | Plan Business | Checkout Business indisponible |
| `VERCEL_GIT_COMMIT_SHA` | Automatique | Automatique | Automatique | Public technique | Version déployée | Affiché `null` hors Vercel |
| `VERCEL_GIT_COMMIT_REF` | Automatique | Automatique | Automatique | Public technique | Branche déployée | Affiché `null` hors Vercel |
| `VERCEL_ENV` | Automatique | Automatique | Automatique | Public technique | Type d’environnement | Fallback sur `NODE_ENV` |
| `VERCEL_URL` | Automatique | Automatique | Automatique | Public technique | URL de déploiement | Fallback sur `APP_BASE_URL` |

## Règles impératives

1. `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `CRON_SECRET`, les secrets Stripe, IMAP, Meta et Yandex ne doivent jamais utiliser le préfixe `NEXT_PUBLIC_`.
2. `CRON_SECRET` doit avoir exactement la même valeur dans Vercel et dans les secrets GitHub Actions.
3. Les secrets de Preview doivent viser une base et des destinataires de test lorsque cela est possible.
4. Les valeurs Stripe doivent rester en **Test Mode** tant que le projet n’est pas explicitement autorisé à accepter des paiements.
5. `ENABLE_MOCK_SOURCE`, `ENABLE_STRIPE` et `ENABLE_WHATSAPP` restent à `false` pour la bêta privée initiale.
6. Toute rotation d’un secret doit être suivie d’un redéploiement Vercel et d’un nouveau test de santé.
