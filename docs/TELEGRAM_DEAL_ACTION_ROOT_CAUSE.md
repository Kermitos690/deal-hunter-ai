# Cause racine — « Action impossible » sur Jeter

Les tables `saved_deals`, `rejected_products` et `auction_reminders` sont uniques sur `(user_id, product_id)`. Sans cible `onConflict` explicite, PostgREST utilise la clé primaire pour l’upsert. Un second clic sur une action déjà enregistrée peut alors produire une violation d’unicité `23505` et afficher « Action impossible » dans Telegram.

Le correctif applicatif force désormais `onConflict: "user_id,product_id"` pour ces trois tables. Les anciens triggers SQL qui supprimaient puis réinséraient les lignes sont retirés, car ils pouvaient changer les identifiants, réinitialiser les dates et perdre les notes d’un deal sauvegardé.
