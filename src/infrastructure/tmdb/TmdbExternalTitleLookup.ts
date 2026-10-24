// Retrouve un film ou une série dans TMDB par son identifiant IMDb (/find) ou TMDB (/movie, /tv),
// pour le partage vers GeoWatch. Noms en français. Sans clé, rien n'est trouvé.

import type { ExternalTitle, ExternalTitleLookup } from "@/domain/ports/ExternalTitleLookup";
import type { TitleType } from "@/domain/Title";
import type { TmdbOptions } from "./TmdbTitleExtras";
import { tmdbGet } from "./tmdbGet";

type TmdbTitle = {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  imdb_id?: string | null;
  external_ids?: { imdb_id?: string | null };
};

export class TmdbExternalTitleLookup implements ExternalTitleLookup {
  private readonly apiKey: string | undefined;
  private readonly fetch: typeof fetch;

  constructor(options: TmdbOptions = {}) {
    this.apiKey = options.apiKey || undefined;
    this.fetch = options.fetch ?? fetch;
  }

  async byImdbId(imdbId: string): Promise<ExternalTitle | null> {
    const found = await this.get<{ movie_results?: TmdbTitle[]; tv_results?: TmdbTitle[] }>(
      `/find/${encodeURIComponent(imdbId)}`,
      { external_source: "imdb_id" },
    );
    const movie = found?.movie_results?.[0];
    if (movie) return toExternalTitle(movie, "MOVIE", imdbId);
    const show = found?.tv_results?.[0];
    return show ? toExternalTitle(show, "SHOW", imdbId) : null;
  }

  async byTmdbId(tmdbId: string, type: TitleType): Promise<ExternalTitle | null> {
    const path = `/${type === "SHOW" ? "tv" : "movie"}/${encodeURIComponent(tmdbId)}`;
    const found = await this.get<TmdbTitle>(path, { append_to_response: "external_ids" });
    return found ? toExternalTitle(found, type, found.imdb_id ?? found.external_ids?.imdb_id ?? null) : null;
  }

  private async get<T>(path: string, params: Record<string, string>): Promise<T | null> {
    if (!this.apiKey) return null;
    const response = await tmdbGet(this.apiKey, this.fetch, path, { ...params, language: "fr-FR" });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`TMDB a répondu ${response.status}`);
    return (await response.json()) as T;
  }
}

function toExternalTitle(found: TmdbTitle, type: TitleType, imdbId: string | null): ExternalTitle {
  const name = found.title ?? found.name ?? "";
  const original = found.original_title ?? found.original_name ?? null;
  const date = found.release_date ?? found.first_air_date ?? "";
  return {
    type,
    name: name || original || "",
    originalName: original && original !== name ? original : null,
    year: /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : null,
    imdbId: imdbId || null,
    tmdbId: String(found.id),
  };
}
