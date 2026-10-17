import type { Title } from "./Title";
import type { TitleDetails } from "./TitleDetails";

// Résumé de la fiche gardé avec le titre, pour les cartes, les tris et les filtres.
export type WatchlistDetails = Pick<
  TitleDetails,
  "directors" | "releaseDate" | "runtime" | "genres" | "imdbScore" | "tmdbScore"
> & { fetchedAt: Date };

// Titre de la liste à voir. Pas de statut « vu » (l'utilisateur utilise Letterboxd pour ça).
// Les identifiants JustWatch, IMDb et TMDB sont dans `title`.
export type WatchlistItem = {
  title: Title;
  // null pour les titres ajoutés avant l'ajout du résumé : complété à la lecture suivante.
  details: WatchlistDetails | null;
  note: string;
  addedAt: Date;
};

export const MAX_NOTE_LENGTH = 2000;

export function toWatchlistEntry(details: TitleDetails, now: Date): { title: Title; details: WatchlistDetails } {
  const { id, type, name, year, posterUrl, imdbId, tmdbId } = details;
  return {
    title: { id, type, name, year, posterUrl, imdbId, tmdbId },
    details: {
      directors: details.directors,
      releaseDate: details.releaseDate,
      runtime: details.runtime,
      genres: details.genres,
      imdbScore: details.imdbScore,
      tmdbScore: details.tmdbScore,
      fetchedAt: now,
    },
  };
}
