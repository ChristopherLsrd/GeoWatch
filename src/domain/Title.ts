// Film ou série du catalogue.

export type TitleType = "MOVIE" | "SHOW";

export type Title = {
  // Identifiant JustWatch (« tm92641 »).
  id: string;
  type: TitleType;
  name: string;
  // Titre original (souvent anglais), pour retrouver un film cité sous ce nom (import Letterboxd).
  // Facultatif : absent des titres enregistrés avant son introduction.
  originalTitle?: string | null;
  year: number | null;
  posterUrl: string | null;
  imdbId: string | null;
  tmdbId: string | null;
};
