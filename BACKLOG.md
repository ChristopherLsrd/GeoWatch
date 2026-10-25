# Backlog GeoWatch

Idées validées mais reportées. À reprendre **à la fin du projet**.


## Recherche de personnes depuis l'accueil (noté le 2026-10-18)

Taper le nom d'un réalisateur ou d'un acteur dans la recherche de l'accueil et obtenir sa page, à côté des titres.
Avant de la construire, il faudra :
- mesurer le temps de traitement ajouté à chaque recherche (une requête JustWatch de plus) ;
- juger si l'affichage des résultats devient brouillon.

## Date de retrait d'une offre (notée le 2026-10-24, abandonnée pour l'instant)

Demande : afficher sur la fiche d'un titre la date à laquelle il quitte une plateforme, et sur l'accueil, un picto « ! » (dans un cercle coloré) sur les titres « disponibles chez moi » qui vont bientôt ne plus l'être.
Abandonnée parce que JustWatch ne renseigne cette date que pour une partie des plateformes.

Test du 2026-10-24 (les 40 films les plus populaires en FR, BE et CA) :
- les offres JustWatch ont les champs `availableTo` (date), `availableToTime` (date et heure UTC) et `availableFromTime` ; on ne les demande pas aujourd'hui (fragment `TitleOffer`). L'introspection GraphQL est désactivée ;
- offres en abonnement avec une date de retrait : 20 sur 98 en FR, 29 sur 98 en BE, 7 sur 144 en CA ;
- HBO Max : presque toujours renseignée (11 sur 11 en FR, 18 sur 18 en BE) ; Prime Video et Disney+ : parfois (2 ou 3 sur 9) ; Netflix, Canal+, Apple TV, Crave et Paramount+ : jamais.

À reprendre si la couverture s'améliore : refaire la même mesure avant de construire quoi que ce soit.

## Suivi des prix : prix cible et autres pays (notés le 2026-10-25)

- **Prix cible par titre** : dans « Ma liste », à côté de la note perso, « préviens-moi sous 3 € ». Alerte dès qu'une offre en France (HD ou 4K) passe sous ce prix, même sans baisse récente.
- **Autres pays** : le suivi des prix ne couvre que la France. Suivre d'autres pays donnerait des alertes dans d'autres devises.
