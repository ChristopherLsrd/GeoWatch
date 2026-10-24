// Fiche d'un titre dans une base externe (TMDB), retrouvée par son identifiant IMDb ou TMDB :
// donne le nom et l'année pour le chercher ensuite dans le catalogue (partage vers GeoWatch).

import type { TitleType } from "../Title";

export type ExternalTitle = {
  type: TitleType;
  // Nom en français s'il existe, sinon le nom original.
  name: string;
  // Nom original, seulement s'il diffère de name.
  originalName: string | null;
  year: number | null;
  imdbId: string | null;
  tmdbId: string;
};

export interface ExternalTitleLookup {
  // null : titre introuvable, ou source non configurée.
  byImdbId(imdbId: string): Promise<ExternalTitle | null>;
  byTmdbId(tmdbId: string, type: TitleType): Promise<ExternalTitle | null>;
}
