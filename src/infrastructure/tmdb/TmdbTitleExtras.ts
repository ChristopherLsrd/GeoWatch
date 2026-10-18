// Langue originale et bande-annonce d'un titre via l'API TMDB (clé gratuite, variable TMDB_API_KEY).
// Une requête (fiche + vidéos en anglais ou sans langue) ; une seconde pour les vidéos dans la langue
// originale quand ce n'est pas l'anglais, car TMDB ne renvoie que les langues de vidéo demandées.
// Sans clé, les deux restent inconnus.

import type { LanguageCode } from "@/domain/Language";
import type { TitleExtras, TitleExtrasProvider } from "@/domain/ports/TitleExtrasProvider";
import type { Title } from "@/domain/Title";
import type { Trailer } from "@/domain/TitleDetails";
import { tmdbGet } from "./tmdbGet";

export type TmdbOptions = {
  // Clé API (v3) ou jeton de lecture (v4, commence par « eyJ »).
  apiKey?: string;
  fetch?: typeof fetch;
};

export type TmdbVideo = {
  iso_639_1: string | null;
  name: string;
  key: string;
  site: string;
  type: string;
  official: boolean;
};

const NOTHING: TitleExtras = { originalLanguage: null, trailer: null };
const TYPES = ["Trailer", "Teaser"];

// Bande-annonce YouTube : langue (originale, anglais, sans langue), puis type (bande-annonce, teaser),
// puis vidéo officielle. null si aucune ne convient.
export function pickTrailer(videos: TmdbVideo[], originalLanguage: LanguageCode | null): Trailer | null {
  const languages = [...new Set([originalLanguage, "en", null])];
  const candidates = videos.filter(
    (v) => v.site === "YouTube" && v.key && TYPES.includes(v.type) && languages.includes(v.iso_639_1 || null),
  );
  const rank = (v: TmdbVideo) => [languages.indexOf(v.iso_639_1 || null), TYPES.indexOf(v.type), v.official ? 0 : 1];
  const best = candidates.sort((a, b) => {
    const [ra, rb] = [rank(a), rank(b)];
    return ra[0] - rb[0] || ra[1] - rb[1] || ra[2] - rb[2];
  })[0];
  return best ? { youtubeKey: best.key, name: best.name, language: best.iso_639_1 || null } : null;
}

export class TmdbTitleExtras implements TitleExtrasProvider {
  private readonly apiKey: string | undefined;
  private readonly fetch: typeof fetch;
  // La langue originale ne change pas, et la bande-annonce rarement : gardées le temps de vie de l'instance.
  private readonly cache = new Map<string, TitleExtras>();

  constructor(options: TmdbOptions = {}) {
    this.apiKey = options.apiKey || undefined;
    this.fetch = options.fetch ?? fetch;
  }

  async extras(title: Pick<Title, "type" | "tmdbId">): Promise<TitleExtras> {
    if (!this.apiKey || !title.tmdbId) return NOTHING;
    const path = `/${title.type === "SHOW" ? "tv" : "movie"}/${encodeURIComponent(title.tmdbId)}`;
    const cached = this.cache.get(path);
    if (cached) return cached;

    try {
      const response = await tmdbGet(this.apiKey, this.fetch, path, { append_to_response: "videos", include_video_language: "en,null" });
      // Erreur passagère : pas de mise en cache, on réessaiera.
      if (!response.ok) return response.status === 404 ? this.remember(path, NOTHING) : NOTHING;
      const body = (await response.json()) as { original_language?: string; videos?: { results?: TmdbVideo[] } };
      const originalLanguage = body.original_language || null;
      let videos = body.videos?.results ?? [];
      if (originalLanguage && originalLanguage !== "en") videos = (await this.videosIn(path, originalLanguage)) ?? videos;
      return this.remember(path, { originalLanguage, trailer: pickTrailer(videos, originalLanguage) });
    } catch {
      return NOTHING;
    }
  }

  // Vidéos dans la langue originale, en anglais ou sans langue ; null en cas d'échec.
  private async videosIn(path: string, language: LanguageCode): Promise<TmdbVideo[] | null> {
    try {
      const response = await tmdbGet(this.apiKey!, this.fetch, `${path}/videos`, { include_video_language: `${language},en,null` });
      if (!response.ok) return null;
      return ((await response.json()) as { results?: TmdbVideo[] }).results ?? [];
    } catch {
      return null;
    }
  }

  private remember(path: string, extras: TitleExtras): TitleExtras {
    this.cache.set(path, extras);
    return extras;
  }
}
