# Deal Hunter AI — Beta Readiness

Dernière mise à jour : 13 juillet 2026  
Branche d’audit et de correction : `agent/harden-production-audit`

## Verdict actuel

**Bêta bloquée.**

Le dépôt contient un MVP SaaS avancé et plusieurs correctifs P0/P1 sont intégrés sur la branche de préparation. La bêta ne peut toutefois pas être déclarée prête avant :

1. application des migrations nouvelles sur Supabase ;
2. validation des variables de production ;
3. exécution réussie de la CI ;
4. vérification réelle de Telegram avec `getMe` et `getWebhookInfo` ;
5. exécution d’au moins un scan eBay réel ;
6. réception d’une alerte Telegram et persistance d’une action Garder/Jeter ;
7. second scan prouvant l’absence de doublon.

## Niveaux utilisés

- **Développée** : le code existe.
- **Configurée** : les variables et ressources externes nécessaires sont présentes.
- **Opérationnelle** : une exécution réelle réussie est prouvée.
- **Prête pour la bêta** : protections, observabilité, tests et procédure de reprise sont suffisants.

## Matrice de vérité

| Domaine | Fonctionnalité | Présente dans le code | Configurée | Testée en production | État réel | Blocage | Priorité | Action effectuée |
|---|---|---:|---:|---:|---|---|---|---|
| Authentification web | Session signée Telegram | Oui | À vérifier | Non prouvé | Développée | Secrets et test réel | P0 | Session HMAC et cookie serveur conservés ; route inspectée |
| Utilisateurs | Création et statut | Oui | Supabase requis | Non prouvé | Développée | Migrations production non vérifiées | P0 | Contrôles de compte suspendu vérifiés |
| Onboarding Telegram | `/start`, `/menu`, langues | Oui | Token requis | Non prouvé | Développée | Bot réel non vérifié | P0 | Health check `getMe` ajouté |
| Radars | Création/modification/activation | Oui | Supabase requis | Non prouvé | Développée | Parcours réel absent | P0 | Route de scan admin unitaire ajoutée |
| Scans manuels | Dashboard, Telegram, admin | Oui | Sources requises | Non prouvé | Développée | Source réelle non prouvée | P0 | Scan admin réutilisant `runRadarScan` |
| Scans automatiques | GitHub Actions toutes les 30 min | Oui | `CRON_SECRET` requis | Non prouvé | Développée | Secret GitHub et run réel | P0 | Workflow durci et résumé Actions ajouté |
| Crons Vercel | Scan et rappels quotidiens | Oui | Vercel requis | Non prouvé | Développée | Double `vercel.json` corrigé sur branche | P1 | Crons ajoutés au fichier racine actif |
| Sources | eBay Browse API | Oui | OAuth inconnu | Non prouvé | Développée | Credentials et scan réel | P0 | Timeouts, cache OAuth, concurrence et quota de requêtes ajoutés |
| Sources | Ricardo | Oui | Désactivée par défaut | Non | Bêta expérimentale | Fragilité HTML/proxy | P2 | Activation explicite obligatoire |
| Sources | Anibis | Oui | Désactivée par défaut | Non | Bêta expérimentale | Fragilité HTML/proxy | P2 | Activation explicite obligatoire |
| Sources | Tutti | Oui | Désactivée par défaut | Non | Bêta expérimentale | Fragilité HTML/proxy | P2 | Activation explicite obligatoire |
| Sources | Komehyo | Oui | Désactivée par défaut | Non | Signal de marché expérimental | Annonces actives, pas ventes | P2 | Activation explicite obligatoire |
| Sources | RSS | Oui | Inconnue | Non prouvé | Développée | Flux non vérifiés | P2 | Diagnostic `misconfigured/disabled` ajouté |
| Sources | Email/IMAP | Oui | Inconnue | Non prouvé | Développée | Compte IMAP et rendement | P1 | Health et scheduler journalisé |
| Sources | Yahoo Japan | Oui | Inconnue | Non prouvé | Développée | Client ID et test | P2 | Activation explicite et diagnostic |
| Sources | Mock | Oui | Désactivée par défaut | Fixture seulement | Test uniquement | Ne doit pas polluer la bêta | P0 | Valeur par défaut passée à `false` |
| Normalisation | URL et fingerprint | Oui | Sans objet | Tests existants | Développée | CI à relancer | P1 | Index renforcés dans migration additive |
| Produits | Upsert source + external ID | Oui | Supabase requis | Non prouvé | Développée | Test réel absent | P0 | Contrainte existante vérifiée |
| Images | Stockage des URLs | Oui | Source requise | Non prouvé | Développée | Test réel absent | P1 | Upsert idempotent vérifié |
| Comparables | Ventes et signaux actifs | Oui | Données insuffisantes | Non prouvé | Partiellement opérationnelle | Ventes conclues récentes insuffisantes | P0 | Pondération active/sold vérifiée ; index région/référence ajouté |
| Scoring | Version v4 | Oui | Sans objet | Tests existants | Développée | CI et backtest réel | P1 | Plafond de confiance faible et discipline d’offre vérifiés |
| Déduplication | Produit global | Oui | Supabase requis | Non prouvé | Développée | Test E2E absent | P0 | Unicité source/external ID vérifiée |
| Déduplication | Déjà vu/rejeté | Oui | Supabase requis | Non prouvé | Développée | Test second scan absent | P0 | Signatures URL/fingerprint/vendeur-prix-titre vérifiées |
| Alertes | Création idempotente | Oui | Supabase requis | Non prouvé | Développée | Envoi réel absent | P0 | Unicité utilisateur/radar/produit vérifiée |
| Alertes | Envoi Telegram | Oui | Token requis | Non prouvé | Développée | Bot/webhook non vérifiés | P0 | Retries transitoires et statuts d’échec ajoutés |
| Inbox Telegram | À trier/top/gardés/rejetés | Oui | Telegram requis | Non prouvé | Développée | Test réel des boutons | P0 | Liaison utilisateur des callbacks vérifiée |
| Actions | Garder | Oui | Supabase requis | Non prouvé | Développée | Test réel absent | P0 | Upsert `saved_deals` et suppression rejet vérifiés |
| Actions | Jeter | Oui | Supabase requis | Non prouvé | Développée | Test second scan absent | P0 | Upsert `rejected_products` vérifié |
| Actions | Négocier/Analyse | Oui | Supabase requis | Non prouvé | Développée | Test UX réel | P1 | Contrôle utilisateur sur l’alerte vérifié |
| Dashboard | Pages utilisateur | Oui | Session requise | Vercel build ancien seulement | Développée | E2E navigateur absent | P1 | Aucun catch-all/iframe lié à ce projet détecté |
| Administration | Contrôle serveur admin | Oui | Admin Telegram requis | Non prouvé | Développée | Session production non testée | P0 | Routes inspectées ; scan unitaire ajouté |
| Administration | `/admin/system-health` | Oui sur branche | Migrations requises | Non | Développée | Déploiement et données réelles | P1 | Page et API détaillées ajoutées |
| Abonnements | Plans et quotas | Oui | Supabase requis | Non prouvé | Développée | Vérification serveur E2E | P1 | Stripe séparé des droits de bêta |
| Stripe | Checkout/portail/webhook | Oui | Inconnue | Non | Préparé mais désactivé | Test mode non prouvé | P2 | `ENABLE_STRIPE=false` obligatoire par défaut |
| Emails | IMAP fast lane | Oui | Inconnue | Non prouvé | Développée | Compte et messages test | P1 | Cron journalisé et état de configuration ajouté |
| Rappels | Enchères Telegram | Oui | Telegram requis | Non prouvé | Développée | Gestion d’erreur par rappel à compléter | P1 | Cron journalisé |
| Observabilité | Scan et sources | Oui | Migrations requises | Non prouvé | Développée | Production non migrée | P0 | `scheduler_runs` et system health ajoutés |
| Sécurité | Webhook Telegram | Oui | Secret requis | Non prouvé | Renforcée | Secret production | P0 | Secret obligatoire, taille limitée, retry sûr, tests ajoutés |
| Sécurité | Webhook WhatsApp | Oui | Désactivé par défaut | Non | Renforcée | Configuration Meta | P1 | HMAC `X-Hub-Signature-256`, taille et flag ajoutés |
| Sécurité | Headers HTTP | Oui sur branche | Déploiement requis | Non | Développée | CI/déploiement | P1 | HSTS, nosniff, frame deny, permissions ajoutés |
| Sécurité | Secrets dans Git | Recherche effectuée | Sans objet | Sans objet | Aucun token actif trouvé dans la tête de branche | Historique à surveiller | P0 | Secret setup codé en dur supprimé |
| Sauvegarde/reprise | Verrou expirant | Oui | Migration requise | Non prouvé | Développée | Test RLS/DB réel | P0 | Fonction SQL inspectée et droits service_role confirmés |
| Sauvegarde/reprise | Journal scheduler | Oui sur branche | Migration requise | Non | Développée | Migration production | P1 | Table `scheduler_runs` ajoutée |
| Sauvegarde/reprise | Backup Supabase | Hors dépôt | Inconnue | Non prouvé | Non vérifiée | Paramètres projet Supabase | P1 | Procédure documentée dans le runbook |

## Correctifs intégrés sur la branche

- suppression du secret de configuration Telegram codé en dur ;
- authentification admin ou `CRON_SECRET` pour la configuration Telegram ;
- vérification du bot attendu et du webhook effectif ;
- libération de `processed_updates` après échec applicatif ;
- limite de taille du webhook Telegram ;
- retries Telegram bornés et classification des erreurs permanentes ;
- signature HMAC obligatoire pour WhatsApp ;
- sources mock et externes désactivées par défaut ;
- limites de concurrence, timeout et cache OAuth eBay ;
- CI GitHub pour typecheck, tests et build ;
- crons déclarés dans le `vercel.json` racine ;
- journal durable des schedulers ;
- page `/admin/system-health` ;
- scan administrateur pour un radar précis ;
- feature flag Stripe explicite ;
- migration additive d’index et maintenance Telegram.

## Preuves encore nécessaires

- résultat vert de `npm run typecheck`, `npm test` et `npm run build` sur la branche ;
- application des migrations `20260713123000` et `20260713130000` ;
- statut Vercel READY du commit final ;
- résultat `getMe` avec `deal_hunter_cards_bot` ;
- résultat `getWebhookInfo` avec l’URL de production ;
- un `scheduler_runs` récent pour chaque job actif ;
- un `source_scan_logs` eBay en succès avec au moins un candidat ;
- un `scan_logs` réussi ;
- un produit, score et alerte créés ;
- une action utilisateur persistée ;
- un second scan sans répétition.
