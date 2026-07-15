# Deal Hunter AI — vérité production au 15 juillet 2026

Ce document distingue strictement le code présent, les fonctions configurées et les exécutions réellement prouvées. Il ne contient aucun secret.

## Référence de production

- Dépôt : `Kermitos690/deal-hunter-ai`
- Branche de production : `main`
- Alias de production : `https://deal-hunter-ai.vercel.app`
- Dernier commit vérifié avant ce lot : `843fa900c238d96f8d32e2051e059dec31ed6305`
- Contrôle Vercel du commit : `success`

## Preuves acquises

### Diffusion Telegram de la version Query Intelligence

Résultat enregistré dans `docs/telegram-release-broadcast-20260715-result.json` :

- statut : `verified_completed` ;
- envoyés : 3 ;
- échecs : 0 ;
- bots bloqués : 0 ;
- ignorés : 0 ;
- restants : 0 ;
- deuxième invocation : mêmes compteurs et `already_completed=true`.

La route one-shot de diffusion a été supprimée après vérification. La route one-shot d’aperçu et les réponses temporaires locales doivent également être retirées par ce lot.

### Fonctionnalités présentes et déployées

- comptes Telegram et connexion dashboard signée ;
- création et gestion de radars privés ;
- dashboard utilisateur et administration ;
- Inbox Telegram et tri des opportunités ;
- actions Garder, Jeter, Négocier, Analyse et Rappel ;
- protections anti-doublons URL, fingerprint et signature vendeur/prix/titre ;
- moteur de requêtes multilingue ;
- application de ce moteur à eBay, Ricardo, Anibis, Tutti et Komehyo ;
- expérience Telegram compacte avec navigation persistante ;
- centre administrateur de diffusion Telegram ;
- verticale Pokémon, canaux, parrainage et sponsoring présents dans le code derrière des feature flags.

## État réel par domaine

| Domaine | Code | Production prouvée | Verdict actuel |
|---|---:|---:|---|
| Déploiement Vercel | Oui | Oui | Opérationnel |
| Bot Telegram | Oui | Oui, diffusion prouvée | Opérationnel, recette utilisateur à compléter |
| Diffusion administrée | Oui | Oui | Opérationnelle |
| Radars et scans | Oui | Partiellement | Recette E2E réelle à consolider |
| eBay | Oui | Non documenté sur le commit courant | Test réel requis |
| Ricardo / Anibis / Tutti | Oui | Non | Expérimental, désactivable |
| Komehyo | Oui | Non | Signal de marché expérimental |
| Supabase migrations | Oui dans Git | État hébergé non entièrement vérifié | Audit et dry-run requis |
| Stripe | Oui | Non | Désactivé pour la bêta privée |
| Parrainage | Oui | Non | Migrations + Stripe requis |
| Canaux | Oui | Non entièrement prouvé | Activation contrôlée requise |
| Sponsoring | Oui | Non | Doit rester désactivé |
| WhatsApp | Oui | Non | Doit rester désactivé |

## P0 — à accomplir avant de déclarer la bêta validée

1. Vérifier les migrations Supabase réellement appliquées jusqu’au dernier durcissement de sécurité requis.
2. Vérifier `getMe` et `getWebhookInfo` pour `deal_hunter_cards_bot`.
3. Exécuter un scan eBay réel et conserver la preuve `source_scan_logs` et `scan_logs`.
4. Recevoir une opportunité Telegram réelle.
5. Exécuter Garder puis Jeter, y compris un second clic idempotent.
6. Relancer le même radar et prouver l’absence de répétition du produit rejeté.
7. Ajouter des tests E2E Playwright pour le dashboard et un scénario Telegram contrôlé.
8. Transformer `/admin/system-health` en gate de recette exportable.

## P1 — stabilisation produit

1. File de jobs durable pour les scans et reprises.
2. Gestion complète des tentatives de rappel.
3. Backtesting prévision/réalité du scoring.
4. Données autorisées de ventes conclues récentes.
5. Tests multi-utilisateur et isolation RLS réelle.
6. Supervision des sources et circuit breakers.

## Fonctions développées mais non activées

Les valeurs suivantes doivent rester désactivées tant que leurs prérequis ne sont pas prouvés :

```text
ENABLE_STRIPE=false
ENABLE_REFERRALS=false
ENABLE_SPONSORED_PLACEMENTS=false
ENABLE_WHATSAPP=false
```

`ENABLE_CHANNELS` peut être activé séparément après migrations et smoke tests, sans activer la publicité.

## Dépendances manuelles

L’automatisation de l’activation de croissance reste bloquée tant que les secrets GitHub Actions Supabase et Vercel ne sont pas ajoutés. Ces secrets doivent être saisis dans les interfaces officielles et ne doivent jamais être transmis dans un commit ou un journal.

## Nettoyage GitHub

- La PR #9 est obsolète : ses protections principales sont déjà présentes dans `main`, qui a largement divergé. Elle ne doit pas être fusionnée.
- L’issue #39 contient un ancien blocage de quota Vercel désormais résolu, mais sa checklist de recette réelle reste pertinente.
- L’issue #48 reste la référence du blocage des secrets d’activation de croissance.

## Prochaine phase

Le prochain lot doit développer le **centre de validation production** et les **tests E2E du parcours radar → scan → Telegram → action → second scan sans doublon**. Aucun nouveau module commercial ne doit être activé avant cette preuve.
