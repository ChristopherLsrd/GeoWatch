import type { Title } from "./Title";

export type CastMember = { name: string; character: string | null };

// Fiche complète d'un titre, pour sa page.
export type TitleDetails = Title & {
  originalTitle: string | null;
  // Code de langue (« en », « ja »…), fourni par TMDB ; null si inconnue.
  originalLanguage: string | null;
  synopsis: string | null;
  // En minutes.
  runtime: number | null;
  // « 2010-07-14 ».
  releaseDate: string | null;
  genres: string[];
  imdbScore: number | null;
  imdbVotes: number | null;
  // Sur 10.
  tmdbScore: number | null;
  directors: string[];
  // Acteurs principaux, dans l'ordre du générique.
  cast: CastMember[];
};

export const MAX_CAST = 10;
