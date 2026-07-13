# Deal Hunter AI — Production Runbook

Ce document décrit les vérifications et procédures d’exploitation de la bêta privée. Il ne contient aucune valeur secrète.

## 1. Vérifier la santé générale

1. Ouvrir `/admin/system-health` avec le compte administrateur.
2. Vérifier les cartes :
   - Base de données : `connected` ;
   - Telegram : `healthy` ;
   - Stripe : `disabled` pour la bêta privée ;
   - Environnement : aucune variable critique manquante.
3. Vérifier :
   - radars dus ;
   - verrous actifs ;
   - erreurs de scans sur 24 heures ;
   - alertes en attente ;
   - alertes Telegram échouées ;
   - dernier passage de `scan`, `reminders` et `email-alerts`.
4. Ouvrir `/api/admin/health` pour le détail JSON. Cette route exige une session administrateur.
5. Ouvrir `/api/version` pour vérifier le commit, la branche et l’environnement déployés.

Un service n’est pas considéré comme opérationnel lorsque son état est seulement `configured` ou `untested`.

## 2. Vérifier Telegram

### Contrôle automatique

La page System Health appelle côté serveur :

- `getMe` ;
- `getWebhookInfo`.

Résultat attendu :

- utilisateur du bot : `deal_hunter_cards_bot` ;
- URL : `https://deal-hunter-ai.vercel.app/api/telegram/webhook` ;
- `pendingUpdateCount` faible ;
- aucune erreur récente ;
- `allowedUpdates` contenant `message` et `callback_query`.

### Réenregistrer le webhook

1. Vérifier dans Vercel :
   - `TELEGRAM_BOT_TOKEN` ;
   - `TELEGRAM_WEBHOOK_SECRET` ;
   - `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` ;
   - `APP_BASE_URL` ;
   - `CRON_SECRET`.
2. Redéployer après toute modification de variable.
3. Appeler `POST /api/telegram/setup` :
   - depuis une session administrateur ; ou
   - avec `Authorization: Bearer <CRON_SECRET>` depuis un terminal sûr.
4. Recharger `/admin/system-health`.

Ne passe jamais un secret dans la query string.

### Test fonctionnel

Dans `@deal_hunter_cards_bot` :

1. `/start` ;
2. `/menu` ;
3. `/language` ;
4. `/radars` ;
5. `/inbox` ;
6. sélectionner un deal de test ;
7. cliquer Garder ou Jeter ;
8. vérifier la persistance dans le dashboard et Supabase.

## 3. Relancer un radar précis

1. Ouvrir `/admin/radars`.
2. Identifier le radar voulu et son propriétaire.
3. Vérifier qu’il est actif et que son utilisateur n’est pas suspendu.
4. Cliquer **Scanner ce radar**.
5. Contrôler ensuite :
   - `scan_logs` ;
   - `source_scan_logs` ;
   - `products` ;
   - `deal_scores` ;
   - `alerts`.

La route utilisée est `/api/admin/radars/[id]/scan`. Elle utilise le moteur principal `runRadarScan`, le verrou distribué et les mêmes logs que le scheduler.

## 4. Débloquer un verrou expiré

Les verrous sont enregistrés dans `radar_scan_locks` et possèdent une date `expires_at`. La fonction d’acquisition remplace automatiquement un verrou expiré.

Procédure :

1. Vérifier `/admin/system-health` → verrous actifs.
2. Dans Supabase SQL Editor, lire uniquement :

```sql
select radar_id, acquired_at, expires_at
from public.radar_scan_locks
order by acquired_at desc;
```

3. Un verrou dont `expires_at <= now()` est expiré et sera repris automatiquement au prochain scan.
4. Ne supprimer manuellement un verrou non expiré qu’après avoir confirmé qu’aucune exécution Vercel ou GitHub Actions n’est active.
5. En cas d’urgence confirmée, supprimer uniquement la ligne du radar concerné, jamais toute la table.

## 5. Identifier une source en panne

1. Ouvrir System Health.
2. Distinguer :
   - `disabled` : volontairement coupée ;
   - `misconfigured` : variable ou credential manquant ;
   - `configured` + `untested` : aucune preuve d’exécution ;
   - `degraded` : dernière exécution en erreur ;
   - `rate_limited` : limitation fournisseur ;
   - `auth_error` : credential invalide ;
   - `healthy` : dernière exécution réussie.
3. Lire le dernier `error_message` sans copier de secret.
4. Pour eBay :
   - vérifier le flag ;
   - vérifier Client ID et Client Secret ;
   - réduire temporairement `EBAY_MAX_REQUESTS_PER_SCAN` si nécessaire ;
   - vérifier les quotas du compte développeur.
5. Pour les sources HTML suisses : désactiver immédiatement la source si le format change ou si les réponses deviennent instables.
6. Ne jamais transformer un échec en tableau vide présenté comme succès.

## 6. Désactiver une source

Dans Vercel, mettre le flag concerné à `false`, puis redéployer :

- `ENABLE_EBAY_SOURCE` ;
- `ENABLE_RICARDO_SOURCE` ;
- `ENABLE_ANIBIS_SOURCE` ;
- `ENABLE_TUTTI_SOURCE` ;
- `ENABLE_KOMEHYO_SOURCE` ;
- `ENABLE_YAHOO_JAPAN_SOURCE` ;
- `ENABLE_RSS_SOURCE` ;
- `ENABLE_EMAIL_ALERTS_SOURCE`.

Le moteur marque alors un radar sans source disponible comme `skipped` avec la raison `no_enabled_source`.

## 7. Traiter les alertes Telegram échouées

Les statuts définitifs ou transitoires sont enregistrés dans `alerts.status` :

- `telegram_token_missing` ;
- `telegram_forbidden` ;
- `telegram_bad_request` ;
- `telegram_rate_limited` ;
- `telegram_api_error`.

Procédure :

1. Identifier les alertes via System Health ou Supabase.
2. `telegram_forbidden` : ne pas réessayer automatiquement ; l’utilisateur doit débloquer le bot et envoyer `/start`.
3. `telegram_bad_request` : inspecter le contenu et les limites Telegram ; corriger avant retry.
4. `telegram_rate_limited` ou `telegram_api_error` : vérifier l’état Telegram, puis relancer de manière contrôlée.
5. Ne jamais remettre en masse toutes les alertes à `created` sans filtrer l’utilisateur et la période.

## 8. Traiter les rappels échoués

Les rappels possèdent :

- `attempt_count` ;
- `last_attempt_at` ;
- `last_error`.

Trois tentatives maximum sont effectuées pour les erreurs transitoires. Les erreurs permanentes sont clôturées immédiatement avec un statut `failed_*`.

Avant un retry manuel : vérifier que l’enchère n’est pas déjà terminée.

## 9. Désactiver les scans

### Un radar

Mettre `is_active=false` depuis le dashboard ou l’administration.

### Tous les schedulers GitHub

1. Ouvrir GitHub → Actions → **Deal Hunter radar scheduler**.
2. Désactiver le workflow, ou retirer temporairement le secret `CRON_SECRET` pour provoquer un échec explicite.
3. Documenter l’heure et la raison.

### Crons Vercel

Les crons proviennent du `vercel.json` racine. Pour les suspendre durablement, modifier la configuration dans une branche, passer la CI, puis déployer. Ne modifie pas directement `main` sans revue.

## 10. Vérifier GitHub Actions

1. Ouvrir Actions.
2. Vérifier le workflow **Deal Hunter radar scheduler**.
3. Le run doit contenir :
   - validation de configuration ;
   - radars dus ;
   - rappels ;
   - fast lane email.
4. Lire le Step Summary : nombre de résultats et d’erreurs.
5. Vérifier que le secret `CRON_SECRET` existe dans **Settings → Secrets and variables → Actions**.
6. Vérifier que sa valeur correspond exactement à Vercel sans l’afficher.

## 11. Vérifier Vercel

1. Ouvrir le projet Deal Hunter AI.
2. Vérifier que le déploiement de production correspond au commit attendu.
3. Vérifier que le statut est READY.
4. Contrôler les variables par environnement : Production et Preview.
5. Après modification d’une variable, lancer un nouveau déploiement.
6. Vérifier les logs Functions sans copier de token, cookie ou payload utilisateur.
7. Tester :
   - `/api/version` ;
   - `/login` ;
   - `/api/telegram/webhook` sans secret, qui doit répondre 401 ;
   - les routes cron sans secret, qui doivent répondre 401.

## 12. Vérifier Supabase

1. Ouvrir Database → Migrations ou SQL Editor.
2. Confirmer que toutes les migrations du dépôt sont appliquées dans l’ordre.
3. Vérifier notamment :
   - `radar_scan_locks` ;
   - `source_scan_logs` ;
   - `deal_score_comparables` ;
   - `scheduler_runs` ;
   - colonnes de tentative des rappels ;
   - indexes de beta readiness.
4. Vérifier les RLS depuis deux utilisateurs Auth de test lorsque l’environnement le permet.
5. Ne jamais tester l’isolation uniquement avec la service role, car elle contourne les RLS.
6. Consulter les paramètres de sauvegarde et de restauration du projet Supabase. Documenter la politique active sans publier l’identifiant du projet.

## 13. Purger les anciennes updates Telegram

La migration ajoute une fonction limitée au rôle serveur :

```sql
select public.cleanup_processed_telegram_updates();
```

Par défaut, elle supprime les updates traitées depuis plus de 14 jours. Utiliser une date explicite uniquement après vérification.

## 14. Revenir au commit précédent

1. Identifier le dernier commit production sain dans Vercel et GitHub.
2. Préférer **Revert** à un force push.
3. Créer une branche de rollback.
4. Revertir le ou les commits applicatifs.
5. Ouvrir une PR et laisser la CI s’exécuter.
6. Fusionner puis vérifier Vercel.
7. Pour une migration additive déjà appliquée, ne supprimer pas les colonnes/tables pendant l’incident. Le code précédent doit ignorer les éléments supplémentaires.

## 15. Activer Stripe ultérieurement

Stripe reste non bloquant pour la bêta privée.

1. Utiliser Stripe Test Mode.
2. Créer les prix Pro et Business.
3. Ajouter les variables de test dans Preview.
4. Créer le webhook vers `/api/billing/webhook`.
5. Tester les événements :
   - `checkout.session.completed` ;
   - `customer.subscription.created` ;
   - `customer.subscription.updated` ;
   - `customer.subscription.deleted` ;
   - `invoice.paid` ;
   - `invoice.payment_failed`.
6. Vérifier l’idempotence avec le même `event_id`.
7. Vérifier la synchronisation des plans et quotas.
8. Mettre `ENABLE_STRIPE=true` uniquement dans Preview.
9. Après validation complète, répéter en production avec une décision commerciale explicite. Aucun paiement réel ne doit être déclenché pendant les tests techniques.

## 16. Test bêta contrôlé

Conserver les identifiants non sensibles suivants :

- commit déployé ;
- utilisateur de test ;
- radar de test ;
- `scan_logs.id` ;
- produit ;
- score et version ;
- alerte et statut ;
- message Telegram ;
- décision Garder/Jeter ;
- résultat du second scan.

Chaîne obligatoire :

```text
Utilisateur test
→ radar actif
→ verrou acquis
→ source eBay réelle
→ produit normalisé
→ images
→ comparables
→ score v4
→ alerte
→ Telegram
→ action utilisateur
→ persistance
→ second scan sans doublon
```

## 17. Critères d’escalade

Arrêter les scans et traiter comme incident P0 en cas de :

- fuite ou suspicion de fuite d’un secret ;
- lecture inter-utilisateurs ;
- création massive d’alertes en double ;
- webhook forgé accepté ;
- migration destructive non planifiée ;
- paiement réel inattendu ;
- source générant massivement de faux produits ou des données interdites.
