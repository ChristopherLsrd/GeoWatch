// Langue originale via l'API TMDB (clé gratuite, variable TMDB_API_KEY).
// Sans clé, la langue originale est simplement inconnue.

import type { LanguageCode } from "@/domain/Language";
import type { OriginalLanguageProvider } from "@/domain/ports/OriginalLanguageProvider";
import type { Title } from "@/domain/Title";
import { tmdbGet } from "./tmdbGet";

export type TmdbOptions = {
  // Clé API (v3) ou jeton de lecture (v4, commence par « eyJ »).
  apiKey?: string;
  fetch?: typeof fetch;
};

export class TmdbOriginalLanguage implements OriginalLanguageProvider {
  private readonly apiKey: string | undefined;
  private readonly fetch: typeof fetch;
  // La langue originale d'un titre ne change pas.
  private readonly cache = new Map<string, LanguageCode | null>();

  constructor(options: TmdbOptions = {}) {
    this.apiKey = options.apiKey || undefined;
    this.fetch = options.fetch ?? fetch;
  }

  async originalLanguage(title: Pick<Title, "type" | "tmdbId">): Promise<LanguageCode | null> {
    if (!this.apiKey || !title.tmdbId) return null;
    const path = `/${title.type === "SHOW" ? "tv" : "movie"}/${encodeURIComponent(title.tmdbId)}`;
    if (this.cache.has(path)) return this.cache.get(path) ?? null;

    try {
      const response = await tmdbGet(this.apiKey, this.fetch, path);
      // Erreur passagère : pas de mise en cache, on réessaiera.
      if (!response.ok) return response.status === 404 ? this.remember(path, null) : null;
      const body = (await response.json()) as { original_language?: string };
      return this.remember(path, body.original_language || null);
    } catch {
      return null;
    }
  }

  private remember(path: string, language: LanguageCode | null): LanguageCode | null {
    this.cache.set(path, language);
    return language;
  }
}
