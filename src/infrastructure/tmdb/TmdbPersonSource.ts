// Biographie, photo et date de décès d'une personne via TMDB (clé TMDB_API_KEY).
// La personne est retrouvée par les crédits d'un titre de sa filmographie, pour éviter les homonymes.

import type { ExternalPersonInfo, PersonInfoHint, PersonInfoSource } from "@/domain/ports/PersonInfoSource";
import { tmdbGet } from "./tmdbGet";

const IMAGE_URL = "https://image.tmdb.org/t/p/w300";

type TmdbCredits = { cast?: { id: number; name: string }[]; crew?: { id: number; name: string }[] };
type TmdbPerson = { biography?: string | null; profile_path?: string | null; deathday?: string | null };

export function normalizeName(name: string): string {
  return name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function findTmdbPersonId(credits: TmdbCredits, name: string): number | null {
  const target = normalizeName(name);
  return [...(credits.cast ?? []), ...(credits.crew ?? [])].find((p) => normalizeName(p.name) === target)?.id ?? null;
}

export class TmdbPersonSource implements PersonInfoSource {
  readonly source = "tmdb" as const;
  private readonly apiKey: string | undefined;
  private readonly fetch: typeof fetch;

  constructor(options: { apiKey?: string; fetch?: typeof fetch } = {}) {
    this.apiKey = options.apiKey || undefined;
    this.fetch = options.fetch ?? fetch;
  }

  async find(hint: PersonInfoHint): Promise<ExternalPersonInfo | null> {
    const title = hint.titles.find((t) => t.tmdbId);
    if (!this.apiKey || !title?.tmdbId) return null;
    try {
      const id = encodeURIComponent(title.tmdbId);
      const credits = await this.json<TmdbCredits>(title.type === "SHOW" ? `/tv/${id}/aggregate_credits` : `/movie/${id}/credits`);
      const personId = credits ? findTmdbPersonId(credits, hint.name) : null;
      if (personId === null) return null;
      const person = await this.json<TmdbPerson>(`/person/${personId}`, { language: "fr-FR" });
      if (!person) return null;
      return {
        biography: person.biography?.trim() || null,
        photoUrl: person.profile_path ? `${IMAGE_URL}${person.profile_path}` : null,
        deathDate: person.deathday || null,
        sourceUrl: `https://www.themoviedb.org/person/${personId}?language=fr`,
      };
    } catch {
      return null;
    }
  }

  private async json<T>(path: string, params?: Record<string, string>): Promise<T | null> {
    const response = await tmdbGet(this.apiKey!, this.fetch, path, params);
    return response.ok ? ((await response.json()) as T) : null;
  }
}
