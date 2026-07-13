# Activation production — croissance Deal Hunter AI

Ce document décrit le workflow `.github/workflows/activate-growth-features.yml`.

## Objectif

Le workflow applique uniquement les migrations de croissance autorisées, configure les feature flags de production et effectue un unique déploiement Vercel.

## Secrets GitHub Actions requis

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_DB_PASSWORD`
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Si un secret manque, le workflow s’arrête avant toute modification externe.

## Migrations autorisées

- `20260713233000_referral_free_months.sql`
- `20260713233500_referral_stripe_claims.sql`
- `20260713234000_referral_entitlement_refresh.sql`
- `20260713235500_channels_and_sponsored_placements.sql`

Le dry-run Supabase bloque l’activation si une autre migration en attente est détectée.

## Feature flags appliqués

- `ENABLE_CHANNELS=true`
- `ENABLE_SPONSORED_PLACEMENTS=false`
- `SPONSORED_ON_PAID_PLANS=false`
- `ENABLE_REFERRALS=true` uniquement lorsque Stripe production est activé et que ses secrets essentiels sont présents ; sinon `false`.

## Validation avant déploiement

Le workflow exécute :

- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

Puis il effectue un seul déploiement Vercel `--prod --force` et teste l’URL immuable ainsi que l’alias `deal-hunter-ai.vercel.app`.

## Rapport d’exécution

À chaque exécution, le workflow crée ou met à jour l’issue GitHub intitulée `Deal Hunter production activation status`.

Le rapport indique uniquement :

- le statut global ;
- l’issue ou l’étape bloquante ;
- le résultat des migrations ;
- le résultat du quality gate ;
- le résultat Vercel ;
- l’état du parrainage ;
- l’URL de déploiement lorsqu’elle existe.

Aucune valeur de secret n’est publiée dans l’issue.

## Sponsoring

Les campagnes sponsorisées restent désactivées jusqu’à la création, l’approbation et le test d’une campagne explicite dans `/admin/channels`.
