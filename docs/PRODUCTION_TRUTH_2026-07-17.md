# Deal Hunter AI — vérité production au 17 juillet 2026

Ce document distingue le code présent, la configuration attendue et les exécutions réellement prouvées. Aucun secret ne doit y être ajouté.

## Références canoniques

- Dépôt : `Kermitos690/deal-hunter-ai`
- Branche de production : `main`
- Application : `https://deal-hunter-ai.vercel.app`
- Bot : `deal_hunter_cards_bot`
- Root Directory Vercel : `saas`
- Configuration Vercel canonique : `saas/vercel.json`
- Scoring courant : `v6`

## Preuves déjà acquises

- déploiement de production du commit `843fa900c238d96f8d32e2051e059dec31ed6305` vérifié avec statut Vercel `success` ;
- diffusion Telegram de version vérifiée : 3 envoyés, 0 échec, 0 bloqué, 0 ignoré, 0 restant ;
- seconde invocation idempotente avec les mêmes compteurs ;
- CI du lot de nettoyage précédent : lint, TypeScript, tests et build réussis ;
- moteur de requêtes multilingue et expérience Telegram compacte intégrés dans `main`.

## État par domaine

| Domaine | Code | Preuve réelle | Verdict |
|---|---:|---:|---|
| Application Vercel | Oui | Oui | Opérationnelle |
| Bot Telegram | Oui | Diffusion prouvée | Recette utilisateur complète requise |
| Radars | Oui | Partielle | E2E requis |
| eBay | Oui | À renouveler sur la version courante | P0 |
| Ricardo / Anibis / Tutti | Oui | Non | Expérimental |
| Komehyo | Oui | Scan historique | Signal actif, pas vente conclue |
| Supabase | Migrations dans Git | État hébergé incomplet | Audit requis |
| Stripe | Oui | Non | Désactivé |
| Parrainage | Oui | Non | Désactivé |
| Canaux | Oui | Non entièrement prouvé | Activation contrôlée |
| Sponsoring | Oui | Non | Doit rester désactivé |

## P0 avant validation bêta

1. Vérifier les migrations Supabase hébergées jusqu’au dernier durcissement de sécurité.
2. Vérifier `getMe` et `getWebhookInfo` pour le bot attendu.
3. Exécuter un scan eBay réel et enregistrer `scan_logs` et `source_scan_logs`.
4. Recevoir une opportunité Telegram réelle.
5. Tester Garder, Jeter et un second clic idempotent.
6. Relancer le radar et prouver l’absence de doublon.
7. Transformer `/admin/system-health` en gate exportable.
8. Ajouter les tests E2E du dashboard et du parcours Telegram contrôlé.

## Configuration Vercel

Le projet Vercel utilise `saas` comme Root Directory. Par conséquent :

- `saas/vercel.json` est l’unique configuration Vercel versionnée ;
- le doublon `vercel.json` à la racine Git doit être supprimé ;
- les crons présents dans `saas/vercel.json` doivent être contrôlés dans le dashboard Vercel ;
- GitHub Actions reste actuellement le scheduler fréquent pour les radars, rappels et alertes e-mail.

## Fonctions à maintenir désactivées

```text
ENABLE_STRIPE=false
ENABLE_REFERRALS=false
ENABLE_SPONSORED_PLACEMENTS=false
ENABLE_WHATSAPP=false
```

`ENABLE_CHANNELS` peut être activé séparément seulement après migrations et smoke tests.

## Prochaine phase

Développer le Production Truth Gate, puis exécuter le scénario officiel :

```text
création radar → scan eBay → score → alerte Telegram → Jeter → second clic → second scan sans doublon
```
