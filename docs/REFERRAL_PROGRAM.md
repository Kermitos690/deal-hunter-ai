# Deal Hunter AI — programme de parrainage

## Règle commerciale

Un utilisateur reçoit un mois gratuit lorsqu’une personne qu’il a invitée effectue son premier paiement d’abonnement réel.

- 1 filleul payé = 1 mois ;
- 12 filleuls payés = 12 mois ;
- un filleul ne qualifie qu’une seule récompense ;
- une facture à 0 CHF ne qualifie pas ;
- l’auto-parrainage est interdit ;
- le code doit être attribué avant le début de l’abonnement ;
- le délai d’attribution est limité aux 30 premiers jours du compte.

## Parcours utilisateur

1. Le parrain ouvre `/dashboard/referrals`.
2. Il partage son lien personnel `/r/CODE`.
3. Le lien dépose un cookie d’attribution de 30 jours, puis ouvre le bot Telegram.
4. Lorsque le filleul ouvre son dashboard depuis le bot, le code est attribué côté serveur.
5. Le premier événement Stripe `invoice.paid` avec un montant réellement payé qualifie le parrainage.
6. Le parrain reçoit immédiatement un mois d’accès Pro dans Deal Hunter AI.
7. Si le parrain possède un abonnement Stripe actif, le système crédite également l’équivalent d’un mois sur son solde client pour sa prochaine facture.

## Anti-fraude et idempotence

- `referred_user_id` est unique ;
- `qualifying_invoice_id` est unique ;
- une récompense est unique par parrainage ;
- l’application Stripe utilise une réservation atomique `available → applying → applied` ;
- la transaction Stripe utilise une clé d’idempotence construite sur l’identifiant de récompense ;
- en cas d’erreur Stripe transitoire, la réservation revient à `available` ;
- les utilisateurs ne peuvent consulter que leurs propres parrainages et récompenses via RLS.

## Accès bêta sans Stripe

La qualification étend `referral_access_until` d’un mois et applique les limites Pro. Le scheduler appelle `refresh_referral_entitlements()` avant les scans afin d’activer les droits et de retirer proprement les promotions expirées.

## Crédit Stripe

Le crédit correspond à un mois du tarif récurrent du parrain :

- tarif mensuel : montant mensuel complet ;
- tarif annuel : un douzième du montant annuel ;
- autres intervalles : équivalent mensuel calculé de manière prudente.

Le crédit est créé comme transaction négative du solde client Stripe et sera appliqué à une prochaine facture éligible.

## Activation

1. Appliquer dans l’ordre les migrations :
   - `20260713233000_referral_free_months.sql` ;
   - `20260713233500_referral_stripe_claims.sql` ;
   - `20260713234000_referral_entitlement_refresh.sql`.
2. Vérifier les tables `referrals` et `referral_rewards` ainsi que les nouvelles colonnes de `users`.
3. Déployer le code.
4. Ajouter dans Vercel :
   - `ENABLE_REFERRALS=true` ;
   - `APP_BASE_URL=https://deal-hunter-ai.vercel.app` ;
   - `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=deal_hunter_cards_bot`.
5. Pour le crédit de facture, activer Stripe en mode test et conserver les événements :
   - `checkout.session.completed` ;
   - `customer.subscription.created` ;
   - `customer.subscription.updated` ;
   - `customer.subscription.deleted` ;
   - `invoice.paid` ;
   - `invoice.payment_failed`.

## Test d’acceptation

- créer un parrain et relever son code ;
- ouvrir le lien dans un navigateur distinct ;
- ouvrir le bot puis le dashboard ;
- vérifier une ligne `referrals.status = pending` ;
- simuler le premier paiement Stripe du filleul ;
- vérifier `referrals.status = rewarded` ;
- vérifier un mois ajouté à `referral_access_until` ;
- vérifier une ligne `referral_rewards` ;
- si Stripe est actif chez le parrain, vérifier `status = applied` et la transaction de solde ;
- rejouer le webhook et vérifier qu’aucun second mois n’est créé.

La fonctionnalité doit rester masquée tant que `ENABLE_REFERRALS` n’est pas activée.
