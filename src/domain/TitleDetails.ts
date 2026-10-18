import type { Title } from "./Title";

// personId : « tp1641 », pour le lien vers sa page ; absent des fiches en cache avant son ajout.
export type CastMember = { name: string; character: string | null; personId?: string | null };

// Bande-annonce YouTube, en version originale de préférence (TMDB).
// language : code de la langue de la vidéo (« en », « ko »…), null si la vidéo n'en indique pas.
export type Trailer = { youtubeKey: string; name: string; language: string | null };

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
  // Fournie par TMDB ; null si aucune.
  trailer: Trailer | null;
};

export const MAX_CAST = 10;
