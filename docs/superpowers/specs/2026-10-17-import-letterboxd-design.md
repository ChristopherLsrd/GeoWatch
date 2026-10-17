# Import de la watchlist Letterboxd

Date : 2026-10-17. Statut : design validé, à implémenter.

## Objectif

Remplir la liste à voir de GeoWatch à partir de la watchlist Letterboxd, sans saisir chaque film à la main.

- Import **ponctuel et ré-importable**. Chaque import ajoute les films absents de GeoWatch et ne retire jamais rien.
- Fichier d'entrée : **`watchlist.csv`**, extrait par l'utilisateur du ZIP d'export Letterboxd. Le ZIP n'est pas accepté.
- Volume attendu : **moins de 100 films**.

Hors périmètre :
- synchronisation, c'est-à-dire le retrait des films qui ont disparu de Letterboxd ;
- import des autres fichiers de l'export (films vus, notes, listes) ;
- import des séries, car la watchlist Letterboxd ne contient que des films.

## Entrée : le CSV Letterboxd

Export : Letterboxd → Settings → Import & Export → Export your data. Le ZIP contient `watchlist.csv`.

En-tête : `Date,Name,Year,Letterboxd URI`.
- `Date` : date d'ajout dans la watchlist, au format `AAAA-MM-JJ`.
- `Name` : titre affiché par Letterboxd, en général anglais ou original.
- `Year` : année de sortie, parfois vide.
- `Letterboxd URI` : lien `https://boxd.it/…`.

Les colonnes sont repérées par leur nom dans l'en-tête, pas par leur position. Le CSV suit la RFC 4180 : champs entre guillemets, virgules et guillemets doublés dans les champs. Il faut aussi accepter un BOM UTF-8 éventuel et les fins de ligne CRLF ou LF.

Une ligne sans `Name` est ignorée et comptée dans « lignes ignorées ». Un `Year` absent ou invalide donne `year: null`. Une `Date` invalide fait prendre la date du jour à l'ajout.

## Correspondance avec JustWatch

Le CSV ne contient ni identifiant IMDb ni identifiant TMDB. On cherche donc chaque film par son titre.

1. On cherche `Name` dans JustWatch avec la recherche existante (`searchTitles`, pays FR, langue fr) et on ne garde que les **films**.
2. On normalise les titres : minuscules, accents retirés, ponctuation retirée, espaces réduits, article initial retiré (`the`, `a`, `an`, `le`, `la`, `les`, `l'`). Le nom Letterboxd est comparé au **titre** JustWatch et au **titre original** JustWatch.
3. **Année compatible** : écart d'un an au plus avec `Year`. Si `Year` est absent, toutes les années sont compatibles.
4. Classement :
   - **sûr** : exactement un film dont le titre normalisé correspond et dont l'année est compatible. Il est ajouté automatiquement.
   - **à valider** : plusieurs films dont le titre correspond et dont l'année est compatible ; ou aucun film dont le titre correspond, mais au moins un film d'année compatible. On renvoie jusqu'à 5 candidats, dans l'ordre de la recherche.
   - **introuvable** : aucun film d'année compatible.
5. Un film dont la correspondance sûre est **déjà dans la liste** est classé « déjà présent » et n'est pas modifié. C'est ce qui rend l'import relançable.

La recherche se fait en français et renvoie des titres français (« Les Évadés »). D'où l'ajout du titre original aux résultats de recherche :
- `Title` reçoit un champ facultatif `originalTitle?: string | null` ;
- `JustWatchGraphqlCatalog` ajoute `originalTitle` à `TITLE_FIELDS`.

Les titres déjà enregistrés dans Mongo n'ont pas ce champ, et c'est sans conséquence.

## Volume de requêtes vers JustWatch

- Par film, on fait une recherche, puis, si on ajoute le film, une lecture de sa fiche par `Watchlist.add`, pour les identifiants et le résumé.
- Pendant l'import, on **ne lance pas** la vérification des offres (`DailyCheck.checkTitle`). Le badge « Chez moi » se remplit plus tard, de deux façons : à l'affichage de la liste, par `WatchlistOverview`, 10 titres par lecture ; et par le cron quotidien.
- Une pause d'environ 1 s sépare deux films. Pour 100 films, cela fait environ 200 requêtes en 2 à 3 minutes.
- Si `CatalogUnavailableError` survient (limitation ou panne de JustWatch), on s'arrête proprement. Les films non traités sont renvoyés pour pouvoir **reprendre**.

## Architecture

### Domaine
- `domain/Title.ts` : ajout de `originalTitle?: string | null`.

### Application, dossier `application/import/`
- `parseLetterboxdCsv.ts`, fonction pure :
  - signature : `parseLetterboxdCsv(text) → { entries: LetterboxdEntry[], skipped: number }` ;
  - type d'une entrée : `LetterboxdEntry = { name: string; year: number | null; addedAt: string | null; letterboxdUri: string | null }`.
- `matchLetterboxd.ts`, fonctions pures :
  - `normalizeTitle(s)` ;
  - `classify(entry, results: Title[]) → { kind: "sure", title } | { kind: "ambiguous", candidates: Title[] } | { kind: "notFound" }`.
- `ImportLetterboxd.ts`, le cas d'usage, construit avec `CatalogProvider`, `Watchlist`, `WatchlistRepository` (pour savoir si un titre est déjà présent) et une pause injectable `sleep(ms)` :
  - `importEntries(entries) → { results: ImportResult[], remaining: LetterboxdEntry[] }`. Un `ImportResult` contient l'entrée et son statut : `added`, `alreadyInList`, `ambiguous` avec ses candidats, ou `notFound`.
  - `resolve(titleId, addedAt) → WatchlistItem` : ajoute le candidat choisi pendant la validation.
- `Watchlist.add(titleId, options?: { addedAt?: Date })` : la date fournie remplace l'horloge. Les appels existants ne changent pas.

### Infrastructure
- `JustWatchGraphqlCatalog` : `originalTitle` dans les résultats de recherche (`toTitle`).
- `container.ts` : instance `importLetterboxd`.

### Route API : `app/api/watchlist/import/route.ts`
Elle est protégée par le middleware existant, qui exige une session.
- `POST { entries: LetterboxdEntry[] }` :
  - **5 entrées au plus** par appel, ce qui garde chaque appel court, loin de la limite de durée Vercel ;
  - la route vérifie les entrées : `name` est une chaîne non vide d'au plus 300 caractères, `year` est un entier ou null, `addedAt` est une date ISO ou null ;
  - réponse : `{ results, remaining }`.
- `POST { resolve: { titleId, addedAt } }` : réponse `{ item }`.
- Erreurs : 400 si les entrées sont invalides ; `catalog_unavailable` traité par `apiErrors.ts` comme ailleurs. Si l'erreur arrive en cours de lot, la route renvoie quand même les résultats déjà obtenus et le reste à traiter, dans `remaining`.

### Front-end, délégué à Sonnet puis relu
- `WatchlistView` : un bouton « Importer depuis Letterboxd » en haut de « Ma liste », vers `/liste/import`.
- `app/liste/import/page.tsx` et le composant `LetterboxdImport.tsx`, qui reprennent le style de la refonte (cartes, boutons, pastilles, accent ambre).
- **Étape 1, le fichier** :
  - le mode d'emploi de l'export ;
  - une zone de dépôt ou de choix du fichier (`accept=".csv"`) ;
  - la lecture se fait dans le navigateur avec `parseLetterboxdCsv`, une fonction pure importable côté client ;
  - affichage de « N films trouvés · M lignes ignorées », puis bouton « Lancer l'import ».
- **Étape 2, la progression** :
  - les films sont envoyés par lots de 5, un lot à la fois ;
  - une barre ambre et « x / N » ;
  - quatre compteurs : ajoutés, déjà dans ma liste, à valider, introuvables ;
  - un bouton « Arrêter » ;
  - en cas de `catalog_unavailable` ou d'erreur réseau, le message « N films non traités » et un bouton « Reprendre ».
- **Étape 3, la validation**, qui se remplit pendant l'import :
  - pour chaque film à valider, le titre et l'année Letterboxd, puis les candidats en cartes (affiche, titre, année) ;
  - un clic sur un candidat appelle `resolve` et marque le film « ajouté » ;
  - « Aucun » écarte le film.
- **Récapitulatif** :
  - le nombre de films ajoutés et un lien vers « Ma liste » ;
  - la liste des introuvables, chacun avec « Chercher dans GeoWatch » (recherche de l'accueil préremplie) et un lien vers sa page Letterboxd.
- **Onglet fermé** : il suffit de relancer l'import avec le même fichier. Les films déjà ajoutés sont ignorés et les cas douteux reviennent. Rien n'est conservé dans le navigateur.

## Tests

Vitest, écrits avant le code.
- `parseLetterboxdCsv` :
  - cas nominal ;
  - guillemets, virgules et guillemets doublés dans `Name` ;
  - BOM, fins de ligne CRLF ;
  - colonnes dans un autre ordre ;
  - `Year` vide ;
  - ligne sans `Name` ignorée ;
  - fichier vide ou sans en-tête attendu, qui donne une erreur explicite.
- `matchLetterboxd` :
  - normalisation (accents, ponctuation, article initial) ;
  - classement sûr par le titre, puis par le titre original ;
  - année à un an près ;
  - plusieurs candidats, qui donnent « à valider » ;
  - aucun titre identique mais une année compatible, qui donne « à valider » ;
  - aucune année compatible, qui donne « introuvable » ;
  - séries exclues ;
  - `Year` absent.
- `ImportLetterboxd`, avec de faux catalogue et dépôt :
  - un film sûr est ajouté avec la date Letterboxd ;
  - un film déjà présent n'est pas modifié ;
  - un film douteux renvoie ses candidats ;
  - `CatalogUnavailableError` arrête l'import et renvoie les films restants ;
  - la pause est appelée entre les films ;
  - `resolve` ajoute le film avec sa date.
- `Watchlist.add` avec l'option `addedAt`.
- `JustWatchGraphqlCatalog` : `originalTitle` est bien dans les titres renvoyés par la recherche.
- Vérification finale :
  - en local, de bout en bout : `next start`, Mongo en mémoire, un petit CSV réel d'environ 5 films et de vrais appels à JustWatch ;
  - sur la prévisualisation Vercel : contrôle de la route, qui doit répondre 401 sans session.

## Livraison

- Branche `feat/import-letterboxd` depuis `main`.
- Commits : la spec, puis le back-end (domaine, application, infrastructure, route, tests), puis le front-end.
- Une PR **vers `main`**.
- Une fois la fonctionnalité livrée, l'entrée correspondante est retirée du `BACKLOG.md`.
