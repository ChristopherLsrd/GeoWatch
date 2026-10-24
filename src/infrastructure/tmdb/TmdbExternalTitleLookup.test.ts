import { describe, expect, it } from "vitest";
import { TmdbExternalTitleLookup } from "./TmdbExternalTitleLookup";

function fakeFetch(status: number, body: unknown) {
  const urls: string[] = [];
  const fn = (async (url: string) => {
    urls.push(url);
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { fn, urls };
}

describe("TmdbExternalTitleLookup", () => {
  it("retrouve un film par son identifiant IMDb, en français", async () => {
    const { fn, urls } = fakeFetch(200, {
      movie_results: [{ id: 278, title: "Les Évadés", original_title: "The Shawshank Redemption", release_date: "1994-09-23" }],
      tv_results: [],
    });
    const found = await new TmdbExternalTitleLookup({ apiKey: "k", fetch: fn }).byImdbId("tt0111161");

    expect(urls[0]).toContain("/find/tt0111161?");
    expect(urls[0]).toContain("external_source=imdb_id");
    expect(urls[0]).toContain("language=fr-FR");
    expect(found).toEqual({ type: "MOVIE", name: "Les Évadés", originalName: "The Shawshank Redemption", year: 1994, imdbId: "tt0111161", tmdbId: "278" });
  });

  it("retrouve une série par son identifiant IMDb, sans nom original quand il est identique", async () => {
    const { fn } = fakeFetch(200, {
      movie_results: [],
      tv_results: [{ id: 1396, name: "Breaking Bad", original_name: "Breaking Bad", first_air_date: "2008-01-20" }],
    });
    expect(await new TmdbExternalTitleLookup({ apiKey: "k", fetch: fn }).byImdbId("tt0903747")).toEqual({
      type: "SHOW", name: "Breaking Bad", originalName: null, year: 2008, imdbId: "tt0903747", tmdbId: "1396",
    });
  });

  it("renvoie null quand /find ne trouve rien", async () => {
    const { fn } = fakeFetch(200, { movie_results: [], tv_results: [] });
    expect(await new TmdbExternalTitleLookup({ apiKey: "k", fetch: fn }).byImdbId("tt0000000")).toBeNull();
  });

  it("retrouve une série par son identifiant TMDB, avec son identifiant IMDb", async () => {
    const { fn, urls } = fakeFetch(200, {
      id: 1396, name: "Breaking Bad", original_name: "Breaking Bad", first_air_date: "2008-01-20", external_ids: { imdb_id: "tt0903747" },
    });
    const found = await new TmdbExternalTitleLookup({ apiKey: "k", fetch: fn }).byTmdbId("1396", "SHOW");

    expect(urls[0]).toContain("/tv/1396?");
    expect(urls[0]).toContain("append_to_response=external_ids");
    expect(found).toEqual({ type: "SHOW", name: "Breaking Bad", originalName: null, year: 2008, imdbId: "tt0903747", tmdbId: "1396" });
  });

  it("renvoie null pour un identifiant TMDB inconnu (404)", async () => {
    const { fn } = fakeFetch(404, { status_message: "not found" });
    expect(await new TmdbExternalTitleLookup({ apiKey: "k", fetch: fn }).byTmdbId("1", "MOVIE")).toBeNull();
  });

  it("lève une erreur quand TMDB refuse ou tombe en panne", async () => {
    const { fn } = fakeFetch(401, { status_message: "Invalid API key" });
    await expect(new TmdbExternalTitleLookup({ apiKey: "k", fetch: fn }).byImdbId("tt0111161")).rejects.toThrow("401");
  });

  it("ne trouve rien sans clé, sans appeler TMDB", async () => {
    const { fn, urls } = fakeFetch(200, {});
    expect(await new TmdbExternalTitleLookup({ fetch: fn }).byImdbId("tt0111161")).toBeNull();
    expect(urls).toHaveLength(0);
  });
});
