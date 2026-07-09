# Scanner local gratuit pour Ricardo, Tutti et Anibis

Ricardo, Tutti et Anibis peuvent bloquer les IP cloud Vercel avec `HTTP 403`.
Le scanner local permet d'exécuter uniquement ces sources depuis le Mac, tout en gardant Supabase, Telegram, le dashboard et les verrous existants.

## Commande manuelle

Depuis le dossier `saas` :

```bash
npm run local-scanner
```

La commande charge automatiquement `.env.local`.

Le script :

- sélectionne les radars actifs des utilisateurs actifs ;
- garde seulement les sources `ricardo`, `anibis`, `tutti` présentes dans chaque radar ;
- utilise le moteur officiel `runRadarScan` ;
- conserve les verrous anti-scan concurrent ;
- n'écrase pas `next_scan_at` (`updateRadarSchedule:false`) ;
- enregistre les produits, scores, alertes et logs comme un scan normal ;
- envoie les alertes Telegram/WhatsApp selon les préférences utilisateur.

## Variables utiles

```bash
LOCAL_LIVE_SCAN_LIMIT=20
LOCAL_LIVE_SCAN_DELAY_MS=2000
ENABLE_RICARDO_SOURCE=true
ENABLE_ANIBIS_SOURCE=true
ENABLE_TUTTI_SOURCE=true
```

Le fichier `.env.local` doit aussi contenir les variables Supabase et Telegram habituelles.

## Automatisation macOS gratuite

Exemple cron toutes les 30 minutes :

```cron
*/30 * * * * cd /chemin/vers/deal-hunter-ai/saas && /usr/local/bin/npm run local-scanner >> /tmp/deal-hunter-local-scanner.log 2>&1
```

À adapter selon le chemin réel de `npm` :

```bash
which npm
```

## Limites

- Le Mac doit être allumé et connecté à internet.
- Les sites peuvent quand même changer leur HTML ou bloquer temporairement.
- Ne pas lancer une fréquence agressive : 30 à 60 minutes est un compromis raisonnable pour une bêta privée.
- Ricardo renvoie un challenge Cloudflare dans certains contextes : sans proxy, navigateur contrôlé ou accord officiel, cette source ne peut pas être garantie.
- Les sources officielles/API/partenariats restent préférables à long terme.
