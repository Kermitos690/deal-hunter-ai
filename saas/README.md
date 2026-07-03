# Deal Hunter AI

V1 SaaS multi-utilisateur pour créer des radars privés, scanner des sources
autorisées, scorer des opportunités et recevoir des alertes Telegram avec
photos et actions.

## Ce qui fonctionne

- compte Telegram via `/start` et connexion dashboard signée ;
- compte administrateur déterminé par `ADMIN_TELEGRAM_ID` ;
- wizard `/newradar` sans intervention admin ;
- radars isolés par `user_id`, API propriétaire et politiques RLS ;
- dashboard radars, deals, alertes, réglages et santé admin ;
- source mock, eBay mondial, Yahoo Shopping Japon, RSS/Atom et alertes e-mail ;
- import manuel JSON et CSV ;
- scoring marge/liquidité/risque/état/urgence ;
- estimation marché prudente avec comparables manuels ;
- anti-doublons global produit + anti-répétition par utilisateur ;
- alertes Telegram avec photo et boutons sauvegarder/rejeter/rappel ;
- réponses A/B pour les enchères et rappels 1h avant ;
- plans Free, Pro et Business préparés.

Deal Hunter AI ne garantit jamais l’authenticité. Les alertes utilisent les
termes « authenticité à vérifier », « risque » et « comparables insuffisants ».

## Architecture

```text
src/app/                 Pages Next.js et routes API
src/components/          Composants dashboard
src/lib/db/              Client Supabase serveur
src/lib/scans/           Orchestration scans et rappels
src/market/              Estimation de marché
src/scoring/             Score sur 100
src/sources/             Adaptateurs indépendants
src/telegram/            Bot, alertes et wizard
src/plans/               Limites SaaS
src/tests/               Tests unitaires
supabase/                Schéma, RLS et seed
scripts/                 Webhook, scans et alerte de test
```

## 1. Installation locale

Prérequis : Node.js 20+, npm et un projet Supabase.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Ouvrir `http://localhost:3000`.

## 2. Variables d’environnement

Renseigner `.env.local` sans jamais le committer.

Obligatoires :

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — uniquement serveur
- `SESSION_SECRET` — au moins 32 caractères aléatoires
- `APP_BASE_URL`

Telegram :

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`
- `ADMIN_TELEGRAM_ID`

Automatisation :

- `CRON_SECRET`
- `ENABLE_MOCK_SOURCE=true`
- `ENABLE_EBAY_SOURCE=false`
- `EBAY_MARKETPLACES=EBAY_CH,EBAY_FR,EBAY_DE,EBAY_IT,EBAY_GB,EBAY_US`
- `ENABLE_YAHOO_JAPAN_SOURCE=false` et `YAHOO_JAPAN_CLIENT_ID`
- `ENABLE_RSS_SOURCE=false` et `PUBLIC_FEED_URLS`
- `ENABLE_EMAIL_ALERTS_SOURCE=false` et les variables IMAP

Facturation Stripe :

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRO_PRICE_ID`
- `STRIPE_BUSINESS_PRICE_ID`

## 3. Base Supabase

Dans l’éditeur SQL Supabase, exécuter dans l’ordre :

1. Installez la CLI Supabase puis lancez `supabase init` si `supabase/config.toml` n'existe pas.
2. Liez le projet hébergé avec `supabase link --project-ref <project-ref>`.
3. Appliquez toutes les migrations versionnées avec `supabase db push`.
4. `supabase/seed.sql` reste optionnel pour ajouter des comparables de démonstration.

Le client `serviceDb()` utilise la service role uniquement dans les routes
serveur. Elle n’est jamais importée dans un composant client.

L’isolation est appliquée deux fois :

- toutes les requêtes applicatives filtrent `user_id` ;
- Supabase RLS empêche un utilisateur Auth de lire ou modifier les données
  appartenant à un autre compte.

## 3.1 Administration et facturation

La page `/admin` permet à l’administrateur principal de consulter les comptes,
leurs radars et leur abonnement, puis de changer un plan ou suspendre un compte.
Chaque modification est enregistrée dans `admin_logs`.

Stripe utilise Checkout en mode abonnement, le portail client et le webhook
`/api/billing/webhook`. Les changements de plan payant sont accordés uniquement
par les événements Stripe signés. Le webhook doit écouter au minimum :

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

## 4. Telegram

Créer le bot avec BotFather puis lancer :

```bash
npm run setup:webhook
```

Le webhook attendu est :

```text
POST /api/telegram/webhook
X-Telegram-Bot-Api-Secret-Token: TELEGRAM_WEBHOOK_SECRET
```

Commandes :

- `/start`
- `/id`
- `/help`
- `/radars`
- `/newradar`
- `/alerts`
- `/deals`
- `/settings`
- `/stop`
- `/resume`

`processed_updates` empêche le traitement répété d’un update Telegram.
`telegram_sessions` stocke l’étape courante du wizard et le choix A/B.

## 5. Premier test fonctionnel

1. Définir `ENABLE_MOCK_SOURCE=true`.
2. Envoyer `/start` au bot.
3. Lancer `/newradar`.
4. Répondre par exemple :
   `maroquinerie`, `Louis Vuitton`, `200`, `B`, `mock`, `20`, `360`.
5. Dans le dashboard, ouvrir le radar et cliquer **Scanner**.
6. Vérifier l’alerte Telegram avec photo.
7. Cliquer **Sauvegarder** puis **Rejeter** et vérifier l’historique.

En ligne de commande :

```bash
npm run scan -- UUID_DU_RADAR
npm run test:alert
```

## 6. Import

JSON :

```http
POST /api/import/manual
Content-Type: application/json

{
  "radarId": "uuid",
  "candidate": {
    "title": "Omega vintage à réparer",
    "price": 340,
    "currency": "CHF",
    "url": "https://example.com/item",
    "source": "manual",
    "imageUrls": ["https://example.com/photo.jpg"],
    "condition": "REPAIR"
  }
}
```

CSV (`POST /api/import/csv`) :

```text
title,price,currency,url,source,image_url,condition,description,auction_end_at
```

## 7. Déploiement Vercel + Supabase

1. Importer le dépôt dans Vercel.
2. Ajouter toutes les variables de `.env.example`.
3. Déployer.
4. Mettre `APP_BASE_URL` sur le domaine Vercel.
5. Relancer `npm run setup:webhook` depuis un environnement configuré.
6. Configurer Vercel Cron ; `vercel.json` contient les deux tâches.
7. Vercel doit appeler les crons avec `Authorization: Bearer CRON_SECRET`.

Pour un contrôle plus précis des fréquences par radar, utiliser Supabase
Scheduled Functions ou un worker dédié qui appelle `runDueScans()`.

## 8. Tests et qualité

```bash
npm run typecheck
npm test
npm run build
```

Les tests couvrent scoring, estimation, anti-doublons, validation radar, plans,
format Telegram et réponses d’enchère A/B.

## 9. Diagnostic

### Le bot spamme le message d’accueil

- vérifier que Telegram n’a qu’un webhook actif ;
- vérifier la clé primaire de `processed_updates` ;
- ne pas appeler `/start` dans un cron ;
- inspecter `/api/admin/scan-logs`.

Le bot envoie l’accueil uniquement sur `/start`.

### Aucune alerte n’arrive

- vérifier `/admin/health` ;
- confirmer que le compte a `alerts_enabled=true` ;
- confirmer que le radar est actif et utilise la source `mock` ;
- réduire temporairement `min_score` et `min_profit` ;
- vérifier `photos_required` ;
- vérifier le quota du plan ;
- vérifier que le produit n’existe pas déjà dans `user_seen_products` ou
  `rejected_products`.

### Couverture mondiale gratuite

SerpAPI n’est pas utilisé. La collecte est fédérée pour éviter un plafond
central :

- eBay Browse API sur plusieurs marketplaces/pays ;
- Yahoo Shopping Japon via l’API officielle ;
- flux RSS/Atom publics configurés dans `PUBLIC_FEED_URLS` ;
- alertes de recherches reçues dans une boîte IMAP dédiée ;
- imports manuels et CSV pour toute autre plateforme ;
- conversion quotidienne des devises vers CHF via Frankfurter, sans clé.

Dans le champ `sources` d’un radar, utiliser par exemple :

```text
ebay,yahoo-japan,rss,email-alerts
```

Une couverture littéralement exhaustive de toutes les annonces mondiales
n’existe pas gratuitement : plusieurs marketplaces n’offrent ni API de
recherche publique ni flux. Pour celles-ci, Deal Hunter utilise leurs alertes
e-mail officielles ou l’import, sans contourner leurs protections.

### Une source réelle ne fonctionne pas

Les connecteurs directs Ricardo, Buyee, Mercari, Komehyo et A-Level restent
désactivés tant qu’une API ou autorisation conforme n’est pas disponible.
Créer des recherches sauvegardées sur ces plateformes et transférer leurs
alertes vers la boîte IMAP dédiée. Aucun scraping agressif n’est inclus.

## Limites V1

- taux de change de référence quotidien, pas un taux bancaire temps réel ;
- comparables actifs eBay et comparables vérifiés, sans garantie de prix vendu ;
- facturation inactive tant que les clés et Price IDs Stripe ne sont pas fournis ;
- adaptateurs hors eBay à connecter uniquement avec autorisation ;
- import CSV retourne les candidats normalisés ; l’interface d’import avancée
  reste à ajouter.

## Priorités suivantes

1. branchement d’un fournisseur de taux de change ;
2. comparables de ventes conclues via un fournisseur autorisé ;
3. file de jobs durable (Supabase Queue/Upstash) ;
4. tests de charge et supervision de la facturation ;
5. sources B2B sous contrat ;
6. tests end-to-end Telegram et Playwright.
