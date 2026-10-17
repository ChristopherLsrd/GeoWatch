# GeoWatch

Outil personnel pour chercher un film ou une série et voir **dans quels pays** il est disponible, **sur quelles plateformes**, avec quel **type d'offre** (abonnement, gratuit, location, achat) et avec quelles **langues audio et sous-titres**.

Application à un seul utilisateur, protégée par mot de passe, déployée sur Vercel.

## Fonctionnalités

- **Recherche** de films et de séries, avec l'historique des 50 dernières recherches.
- **Page d'un titre** :
  - fiche (synopsis, notes IMDb et TMDB, réalisation, distribution, langue originale) ;
  - disponibilités dans 139 pays, chargées par lots : pays francophones d'abord, puis le reste ;
  - regroupement par plateforme, avec les variantes d'un même service réunies (Netflix avec pub, chaînes Prime Video…) ;
  - une ligne par pays avec ses offres, ses langues et sa qualité, et un lien direct vers la plateforme ;
  - filtres par type d'offre, plateforme, langue audio et sous-titres.
- **Badge « Disponible chez moi »** : le titre est disponible en abonnement sur une plateforme, dans un pays où l'on est abonné.
- **Liste à voir** :
  - note perso, tri, filtres et recherche ;
  - cartes sur l'accueil avec l'affiche, l'année et le réalisateur.
- **Abonnements** (plateforme et pays) et **préférences de langue** (audio, dont « Version originale », et sous-titres), appliquées par défaut aux filtres.
- **Vérification quotidienne** (cron Vercel) : elle revérifie la liste à voir et signale sur l'accueil les titres arrivés sur une de vos plateformes ou devenus disponibles en VF.

## Sources de données

- **API GraphQL non officielle de JustWatch** : titres, offres par pays, langues audio et sous-titres. Elle n'est pas documentée, peut changer sans préavis, et n'est tolérée que pour un usage privé et non commercial. Les appels se font uniquement côté serveur. Les disponibilités sont mises en cache pour la journée (heure de Paris) afin de limiter le volume de requêtes.
- **TMDB** (facultatif) : langue originale des titres, pour la préférence « Version originale ».

Les drapeaux des pays viennent de la police TwemojiCountryFlags (projet [country-flag-emoji-polyfill](https://github.com/talkjs/country-flag-emoji-polyfill), graphismes [Twemoji](https://github.com/jdecked/twemoji) sous licence CC-BY 4.0), intégrée à l'application parce que Windows n'affiche pas les emoji de drapeaux.

## Stack

- **Next.js 15** (App Router), **React 19** et **TypeScript**.
- **MongoDB Atlas** (pilote officiel `mongodb`).
- **Vercel** (offre Hobby), avec un cron quotidien défini dans `vercel.json`.
- **Vitest** pour les tests, avec `mongodb-memory-server` pour les adaptateurs Mongo.

## Architecture

Clean architecture proportionnée : le domaine ne dépend de rien, et JustWatch peut être remplacé derrière le port `CatalogProvider`.

```
src/
  domain/          entités et objets-valeurs (Title, Offer, Availability, Country…), ports
  application/     cas d'usage (recherche, disponibilités, liste à voir, abonnements,
                   historique, préférences, vérification quotidienne) et fonctions pures
                   de regroupement, de tri et de filtrage
  infrastructure/  JustWatch (GraphQL), TMDB, adaptateurs Mongo, authentification,
                   assemblage des dépendances (container.ts)
  config/          listes modifiables : priorité des pays, langues proposées,
                   regroupement des plateformes
  app/             pages, composants et routes API Next.js, middleware d'accès
```

## Accès

- Une page de connexion vérifie un mot de passe unique (`APP_PASSWORD`), comparé en temps constant.
- La session est un cookie httpOnly signé (HMAC-SHA256, `SESSION_SECRET`), valable 30 jours.
- Après 5 échecs en 15 minutes depuis une même adresse IP, la connexion est bloquée pendant 15 minutes (compteur stocké dans Mongo).
- Le middleware bloque toutes les pages et routes API sans session valide. La route du cron (`/api/cron/*`) n'exige pas de session : elle demande à la place l'en-tête `Authorization: Bearer <CRON_SECRET>`.

## Installation locale

Prérequis : Node.js 20 ou plus, et une base MongoDB (Atlas ou locale).

```bash
npm install
cp .env.example .env.local   # puis remplir les valeurs
npm run dev                  # http://localhost:3000
```

### Variables d'environnement

| Variable | Rôle |
| --- | --- |
| `APP_PASSWORD` | Mot de passe de connexion |
| `SESSION_SECRET` | Secret de signature du cookie (au moins 32 caractères aléatoires) |
| `CRON_SECRET` | Secret attendu par la route du cron (Vercel l'envoie automatiquement) |
| `MONGODB_URI` | Chaîne de connexion MongoDB |
| `MONGODB_DB` | Nom de la base (facultatif, `geowatch` par défaut) |
| `TMDB_API_KEY` | Clé API TMDB v3 ou jeton v4 (facultatif : sans clé, la langue originale reste inconnue) |

## Scripts

```bash
npm run dev     # serveur de développement
npm run build   # build de production
npm start       # serveur de production
npm test        # tests (Vitest)
```

## Déploiement

Le projet est relié à Vercel par l'intégration Git :

- chaque pull request reçoit un déploiement de prévisualisation (protégé par Vercel) ;
- chaque fusion dans `main` déploie en production.

La branche `main` est protégée : toute modification passe par une pull request. Les variables d'environnement sont définies dans Vercel, en Production et en Preview. Le cron quotidien ne tourne que sur la production. On peut aussi le lancer à la main depuis le tableau de bord Vercel (Settings → Cron Jobs).

