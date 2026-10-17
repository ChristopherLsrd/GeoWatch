import { describe, expect, it } from "vitest";
import { TmdbOriginalLanguage } from "./TmdbOriginalLanguage";

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, headers: init.headers as Record<string, string> });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

describe("TmdbOriginalLanguage", () => {
  it("lit la langue originale d'un film avec une clé v3, et la garde en mémoire", async () => {
    const { fn, calls } = fakeFetch(200, { original_language: "en" });
    const tmdb = new TmdbOriginalLanguage({ apiKey: "cle", fetch: fn });
    expect(await tmdb.originalLanguage({ type: "MOVIE", tmdbId: "27205" })).toBe("en");
    expect(await tmdb.originalLanguage({ type: "MOVIE", tmdbId: "27205" })).toBe("en");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.themoviedb.org/3/movie/27205?api_key=cle");
  });

  it("utilise un jeton v4 en en-tête, et le chemin tv pour une série", async () => {
    const { fn, calls } = fakeFetch(200, { original_language: "fr" });
    const tmdb = new TmdbOriginalLanguage({ apiKey: "eyJjeton", fetch: fn });
    expect(await tmdb.originalLanguage({ type: "SHOW", tmdbId: "62649" })).toBe("fr");
    expect(calls[0].url).toBe("https://api.themoviedb.org/3/tv/62649");
    expect(calls[0].headers).toEqual({ Authorization: "Bearer eyJjeton" });
  });

  it("renvoie null sans clé, sans identifiant TMDB ou en cas d'erreur", async () => {
    const { fn, calls } = fakeFetch(500, {});
    expect(await new TmdbOriginalLanguage({ fetch: fn }).originalLanguage({ type: "MOVIE", tmdbId: "1" })).toBeNull();
    const tmdb = new TmdbOriginalLanguage({ apiKey: "cle", fetch: fn });
    expect(await tmdb.originalLanguage({ type: "MOVIE", tmdbId: null })).toBeNull();
    expect(await tmdb.originalLanguage({ type: "MOVIE", tmdbId: "1" })).toBeNull();
    expect(calls).toHaveLength(1);
  });
});
