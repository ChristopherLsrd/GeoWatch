# Performances de chargement et refactoring ciblé

Date : 2026-10-18. Statut : design validé dans ses grandes lignes, à relire.

## Objectif

L'utilisateur trouve lents l'**accueil**, **« Ma liste »** et la **page d'un titre**. Ce chantier doit rendre ces écrans rapides sans changer leur comportement visible, et sans augmenter le volume de requêtes vers JustWatch. Les fichiers touchés et les plus gros composants sont refactorisés au passage.

Hors périmètre :
- la taille des lots de pays (15 à 20, décision du `CLAUDE.md`) ;
- toute nouvelle fonctionnalité ;
- une refonte générale de l'architecture, qui est saine.

## Constat

- **Régions** : les fonctions Vercel tournent en `iad1` (Virginie), alors que le cluster MongoDB Atlas est à Paris. Chaque accès à Mongo traverse l'Atlantique (80 à 100 ms aller-retour), et un écran en fait des dizaines.
- **Accueil et « Ma liste »** : `GET /api/watchlist` (`WatchlistOverview.list`) attend avant de répondre :
  - la vérification de 10 titres au plus parmi ceux qui n'ont pas encore de badge « Chez moi », un par un (`DailyCheck.checkTitle`). Chaque vérification fait plusieurs accès à Mongo et une requête à JustWatch ;
  - le complément de fiche de 20 titres au plus (`Watchlist.list`), lui aussi un par un.
  - Après l'import Letterboxd, la plupart des films n'ont pas de badge : chaque ouverture paie jusqu'à 10 vérifications.
  - En plus, le navigateur ne demande la liste qu'après le chargement de la page : rien ne s'affiche avant la réponse.
- **Page d'un titre** : les 139 pays sont demandés en 8 lots de 20, l'un après l'autre.
- **Gros composants** : `OfferResults.tsx` (435 lignes), `TitleView.tsx` (410), `LetterboxdImport.tsx` (366).

## Lot 1 : mesure et région

### Mesure : en-tête `Server-Timing`
- Les routes `GET /api/watchlist`, `POST /api/watchlist/check` (lot 2) et `GET /api/titles/[id]/availability` renvoient un en-tête `Server-Timing`. L'utilisateur le lit dans l'onglet Réseau de son navigateur.
  - `mongo;dur=…` : temps cumulé des commandes Mongo de la requête ;
  - `justwatch;dur=…` : temps cumulé des appels à JustWatch ;
  - `total;dur=…` : temps total de la route.
- Mise en œuvre, dans `src/infrastructure/timing/` :
  - le temps est accumulé par requête grâce à `AsyncLocalStorage` ;
  - le temps Mongo vient de la surveillance des commandes du pilote (`monitorCommands: true`, événements `commandSucceeded` et `commandFailed`, qui donnent `duration`) ;
  - le temps JustWatch est mesuré autour de `fetch`, dans `JustWatchGraphqlCatalog.post` ;
  - une fonction `withTiming(handler)` enveloppe les route handlers et ajoute l'en-tête.
- Le domaine et l'application ne changent pas.

### Région
- `vercel.json` : `"regions": ["cdg1"]` (Paris), à côté du cluster Atlas. L'offre Hobby permet de choisir une région.
- Le cron reste à 5 h UTC.
- Risque : JustWatch n'a été validé que depuis `iad1`. La route de faisabilité a été retirée et une route protégée ne peut pas être appelée sans session. La validation se fait donc sur la prévisualisation, par l'utilisateur connecté : il ouvre un titre et vérifie que les pays s'affichent. Si JustWatch bloque `cdg1`, on revient à `iad1` et seule la mesure est fusionnée.

### Vérification
- Relevé `Server-Timing` sur la production actuelle (`iad1`) avant la fusion, puis sur la prévisualisation `cdg1`, pour les trois routes : accueil, « Ma liste » et un titre.

## Lot 2 : accueil et « Ma liste »

### Côté serveur
- **`GET /api/watchlist`** répond tout de suite, sans vérification à la volée ni complément de fiche.
  - `WatchlistOverview.list` lit en parallèle (`Promise.all`) la liste, les abonnements et **tous** les états de vérification.
    - Il y a un seul utilisateur et un état par titre de la liste, donc la collection reste petite. On peut la lire en entier sans attendre la liste des identifiants.
    - `WatchStatusRepository` reçoit pour cela une méthode `list()`.
    - On passe de deux allers-retours Mongo successifs à un seul.
  - La réponse indique `pending` : le nombre de titres sans badge ou sans fiche complète.
- **Nouvelle route `POST /api/watchlist/check`** :
  - elle vérifie au plus **3** titres sans badge, en complétant d'abord leur fiche si elle manque ;
  - elle renvoie `{ items, pending }` : les éléments mis à jour, au même format que `GET`, et le nombre restant ;
  - ordre de traitement : du plus récemment ajouté au plus ancien ;
  - 503 `catalog_unavailable` si JustWatch est indisponible avant le premier titre. Sinon, la route renvoie ce qui a été fait.
  - Les plafonds actuels sont repris : 10 vérifications et 20 compléments au plus par lecture. Le client s'arrête une fois ces totaux atteints dans un même affichage, si bien que le volume ne dépasse pas celui d'aujourd'hui.
- Les abonnements sont lus une seule fois par appel, au lieu d'une fois par titre (`DailyCheck.checkTitle` reçoit les abonnements, ou une variante `checkTitles` les lit une fois).
- `Watchlist.list` ne complète plus les fiches. Le complément passe dans le nouveau cas d'usage, avec la vérification.

### Côté navigateur : copie locale et hook partagé
- Nouveau hook `useWatchlist()`, utilisé par `WatchlistCards` (accueil) et `WatchlistView` (« Ma liste »), qui chargent aujourd'hui la liste chacun de leur côté :
  1. **Copie locale** : à l'ouverture, la dernière liste reçue est lue dans `localStorage` (clé `geowatch:watchlist:v1`) et affichée tout de suite.
  2. `GET /api/watchlist` remplace ensuite la copie, à l'écran et dans `localStorage`.
  3. Si `pending > 0`, le hook appelle `POST /api/watchlist/check` en boucle, un appel à la fois, et fusionne les éléments reçus à mesure. Il s'arrête quand `pending` vaut 0, sur une erreur, quand les plafonds sont atteints ou quand la page est quittée.
  4. Les changements faits sur la page (ajout, retrait, note) mettent aussi la copie à jour.
- La copie est un confort : chaque lecture et chaque écriture est entourée d'un `try/catch`. Si elle est absente, illisible ou d'un autre format, on attend simplement la réponse du serveur, comme aujourd'hui.
- La copie est effacée à la déconnexion.
- Une copie en retard (un film ajouté depuis un autre appareil) est corrigée dès l'arrivée de la réponse du serveur.

### Tests
- `WatchlistOverview` : la liste ne déclenche plus de vérification ; `pending` est bien compté.
- Nouveau cas d'usage de vérification par petits lots :
  - 3 titres au plus ;
  - fiche complétée avant la vérification ;
  - arrêt sur `CatalogUnavailableError`, avec le travail déjà fait renvoyé ;
  - abonnements lus une seule fois.
- `Watchlist.list` ne fait plus d'appel au catalogue.

## Lot 3 : page d'un titre

- Le premier lot, celui des pays prioritaires (`countryBatches()[0]`), reste seul, pour un premier affichage rapide. Les lots suivants partent **2 par 2** en parallèle. Les résultats s'affichent dans l'ordre d'arrivée, et le tri des pays ne dépend pas de cet ordre.
- « Réessayer » et « Actualiser » gardent leur comportement :
  - après un arrêt, seuls les lots non reçus sont redemandés ;
  - le compteur « N pays non vérifiés » reste juste ;
  - un lot réussi alors que son voisin a échoué est conservé.
- Le volume de requêtes vers JustWatch est inchangé : 8 lots, une requête par lot si le cache est vide.
- La boucle des lots sort de `TitleView` dans un hook `useAvailabilityBatches(id)`, qui gère l'état, l'abandon, la reprise et l'actualisation. La logique de concurrence est une fonction pure testée par Vitest : file de lots, 2 au plus en vol, arrêt au premier échec.

## Lot 4 : refactoring ciblé

Sans changement de comportement ni de rendu :
- `OfferResults.tsx` : séparer les filtres, la liste des plateformes et la ligne d'un pays en sous-composants. Les calculs purs (filtrage, regroupement) restent dans `application/catalog` ou y vont, avec leurs tests.
- `TitleView.tsx` : après l'extraction du lot 3, séparer la fiche (notes, synopsis, équipe) et l'en-tête.
- `LetterboxdImport.tsx` : sortir la boucle d'import dans un hook `useLetterboxdImport`, et l'étape « fichier », la progression et les cartes « à valider » dans des sous-composants.
- Au fil des lots 2 et 3, nettoyer le code touché (duplications, noms) sans élargir le périmètre.

## Contraintes

- Volume vers JustWatch inchangé ou plus faible : ni requête ni concurrence nouvelle au-delà de 2 lots en vol sur la page d'un titre.
- Les appels à JustWatch restent côté serveur.
- Les décisions du `CLAUDE.md` sont respectées : lots de 15 à 20 pays, cache par jour de Paris, ordre d'affichage.
- Le front-end est délégué à Sonnet, puis relu.
- Tests Vitest écrits avant le code pour toute logique nouvelle. `tsc`, `next build`, puis un test de bout en bout local (`next start`, Mongo en mémoire) pour chaque lot.

## Livraison

- Une branche et une PR **vers `main`** par lot, dans l'ordre 1, 2, 3, 4. Chaque lot part de `main` une fois le précédent fusionné, ou est reciblé vers `main` avant la fusion.
- Chaque PR donne les relevés `Server-Timing` avant et après, quand le lot touche une route mesurée.
- Le `CLAUDE.md` est mis à jour : région `cdg1`, et chargement progressif des badges de la liste.
