// Film ou série du catalogue.

export type TitleType = "MOVIE" | "SHOW";

export type Title = {
  // Identifiant JustWatch (« tm92641 »).
  id: string;
  type: TitleType;
  name: string;
  year: number | null;
  posterUrl: string | null;
  imdbId: string | null;
  tmdbId: string | null;
};
