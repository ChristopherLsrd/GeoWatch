import type { CountryCode } from "../Country";
import type { FilmographyEntry } from "../Person";
import type { TitleType } from "../Title";

export const RATING_PAGE_SIZE = 40;

export type RatingSort = "popular" | "imdb" | "year" | "alpha";
export const RATING_SORTS: RatingSort[] = ["popular", "imdb", "year", "alpha"];

// Titres d'une classification d'âge dans un pays, filtrés et triés par le catalogue.
export type RatingQuery = {
  country: CountryCode;
  code: string;
  // null : films et séries.
  type: TitleType | null;
  search: string | null;
  // Code de genre du catalogue (« scf »).
  genre: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  imdbMin: number | null;
  // Seulement les titres en abonnement sur une plateforme de l'utilisateur dans ce pays.
  homeOnly: boolean;
  sort: RatingSort;
  // Curseur de la page suivante ; null pour la première.
  after: string | null;
};

// Carte d'un titre, sans les plateformes en abonnement (demandées à part, pour les seuls titres gardés).
export type RatedTitle = Omit<FilmographyEntry, "flatrate">;

export type RatingPage = { titles: RatedTitle[]; total: number; nextCursor: string | null };

export type Genre = { code: string; label: string };

export interface RatingCatalog {
  // homePlatformIds : plateformes (Platform.id) où l'utilisateur est abonné dans query.country, pour homeOnly.
  // CatalogUnavailableError si le catalogue refuse nos requêtes.
  list(query: RatingQuery, homePlatformIds: string[]): Promise<RatingPage>;
  // Plateformes en abonnement (Platform.id) de chaque titre, par pays demandé.
  flatrate(titleIds: string[], countries: CountryCode[]): Promise<Map<string, FilmographyEntry["flatrate"]>>;
  // Genres du catalogue, libellés en français, triés.
  genres(): Promise<Genre[]>;
}
