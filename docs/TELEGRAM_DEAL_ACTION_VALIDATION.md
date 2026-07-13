# Validation des actions Telegram sur les deals

## Objectif

Prouver qu’une action répétée depuis Telegram reste idempotente et qu’un produit rejeté ne réapparaît pas lors du scan suivant.

## Scénario de validation production

1. Déployer le commit exact contenant le correctif d’upsert.
2. Vérifier que les migrations Supabase sont à jour, notamment la suppression des anciens triggers de suppression/réinsertion.
3. Recevoir une opportunité issue d’un scan eBay réel.
4. Appuyer une première fois sur **Jeter** et vérifier le message de confirmation.
5. Appuyer une seconde fois sur le même ancien bouton et vérifier qu’aucune erreur `Action impossible` n’apparaît.
6. Contrôler dans `rejected_products` qu’une seule ligne existe pour le couple `(user_id, product_id)`.
7. Contrôler que l’alerte porte le statut `rejected`.
8. Relancer le même radar.
9. Vérifier que le produit exact et ses doublons probables ne sont pas reproposés.

## Logs utiles

Rechercher dans les logs serveur :

- `deal_action_rejected`
- `Action bouton Telegram impossible`
- les erreurs PostgreSQL `23505`

Le test est considéré comme réussi uniquement si le second clic reste sans erreur et si le second scan n’émet pas à nouveau le produit rejeté.
