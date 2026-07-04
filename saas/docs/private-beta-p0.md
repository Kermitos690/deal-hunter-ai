# Stabilisation P0 — bêta privée

## Automatisation

Le workflow historique `.github/workflows/python.yml` est conservé pour audit mais
son planning est supprimé et son unique job est désactivé. Il ne doit plus être
utilisé. Le seul scheduler automatique officiel est
`.github/workflows/radar-scheduler.yml`.

## Secrets à révoquer ou vérifier

- Régénérer `TELEGRAM_BOT_TOKEN`, le remplacer dans Vercel, puis réinstaller et tester le webhook.
- Régénérer `EMAIL_APP_PASSWORD` et le remplacer dans Vercel.
- Supprimer de GitHub Secrets `SERPAPI_API_KEY`, `SERPAPI_COUNTRIES`,
  `GSHEET_ACTION_TOKEN`, `GSHEET_ACTION_WEBHOOK_URL` et les anciens
  `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` après confirmation que seul le SaaS est utilisé.
- Vérifier `CRON_SECRET`, `TELEGRAM_WEBHOOK_SECRET` et `SESSION_SECRET` dans Vercel.
- Ne jamais copier ces valeurs dans Git, les logs ou une documentation.

## Contrôles après rotation Telegram

1. Redéployer Vercel.
2. Réinstaller le webhook avec le nouveau jeton.
3. Vérifier `getWebhookInfo`.
4. Envoyer `/start`, `/id` et créer une alerte de test.
5. Vérifier qu’un ancien jeton retourne bien `401`.
