// Film ou série du catalogue.

import type { PersonRef } from "./PersonRef";

export type TitleType = "MOVIE" | "SHOW";

export type Title = {
  // Identifiant JustWatch (« tm92641 »).
  id: string;
  type: TitleType;
  name: string;
  // Titre original (souvent anglais), pour retrouver un film cité sous ce nom (import Letterboxd).
  // Facultatif : absent des titres enregistrés avant son introduction.
  originalTitle?: string | null;
  // Réalisateurs, fournis avec les résultats de recherche (choix d'un candidat à l'import Letterboxd).
  // Facultatif, comme originalTitle.
  directors?: string[];
  // Liens vers les pages des réalisateurs (identifiants JustWatch). Facultatif : absent des titres enregistrés avant.
  directorRefs?: PersonRef[];
  year: number | null;
  posterUrl: string | null;
  imdbId: string | null;
  tmdbId: string | null;
};
