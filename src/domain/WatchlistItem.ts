import type { Title } from "./Title";

// Titre de la liste à voir. Pas de statut « vu » (l'utilisateur utilise Letterboxd pour ça).
// Les identifiants JustWatch, IMDb et TMDB sont dans `title`.
export type WatchlistItem = {
  title: Title;
  note: string;
  addedAt: Date;
};

export const MAX_NOTE_LENGTH = 2000;
