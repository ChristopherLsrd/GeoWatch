import { describe, expect, it } from "vitest";
import { findTmdbPersonId, normalizeName, TmdbPersonSource } from "./TmdbPersonSource";

function routes(table: Record<string, { status: number; body: unknown }>) {
  const urls: string[] = [];
  const fn = (async (url: string) => {
    urls.push(url);
    const path = new URL(url).pathname.replace("/3", "");
    const hit = table[path];
    return new Response(JSON.stringify(hit?.body ?? {}), { status: hit?.status ?? 404 });
  }) as unknown as typeof fetch;
  return { fn, urls };
}

const hint = { name: "Christopher Nolan", titles: [{ type: "MOVIE" as const, tmdbId: null }, { type: "MOVIE" as const, tmdbId: "27205" }] };

describe("normalizeName / findTmdbPersonId", () => {
  it("ignore la casse, les accents et les espaces en trop", () => {
    expect(normalizeName("  Agnès   VARDA ")).toBe("agnes varda");
  });

  it("cherche la personne parmi les acteurs et l'équipe", () => {
    const credits = { cast: [{ id: 6193, name: "Leonardo DiCaprio" }], crew: [{ id: 525, name: "Christopher Nolan" }] };
    expect(findTmdbPersonId(credits, "christopher nolan")).toBe(525);
    expect(findTmdbPersonId(credits, "Inconnu")).toBeNull();
  });
});

describe("TmdbPersonSource", () => {
  it("retrouve la personne par les crédits d'un titre, puis lit sa fiche en français", async () => {
    const { fn, urls } = routes({
      "/movie/27205/credits": { status: 200, body: { cast: [], crew: [{ id: 525, name: "Christopher Nolan" }] } },
      "/person/525": { status: 200, body: { biography: " Bio FR ", profile_path: "/abc.jpg", deathday: null } },
    });
    const info = await new TmdbPersonSource({ apiKey: "cle", fetch: fn }).find(hint);
    expect(info).toEqual({
      biography: "Bio FR",
      photoUrl: "https://image.tmdb.org/t/p/w300/abc.jpg",
      photoPageUrl: "https://www.themoviedb.org/person/525?language=fr",
      deathDate: null,
      sourceUrl: "https://www.themoviedb.org/person/525?language=fr",
    });
    expect(urls[1]).toBe("https://api.themoviedb.org/3/person/525?language=fr-FR&api_key=cle");
  });

  it("lit les crédits agrégés d'une série", async () => {
    const { fn, urls } = routes({
      "/tv/1399/aggregate_credits": { status: 200, body: { cast: [{ id: 1, name: "X" }], crew: [] } },
      "/person/1": { status: 200, body: { biography: "", profile_path: null, deathday: "2020-01-01" } },
    });
    const info = await new TmdbPersonSource({ apiKey: "cle", fetch: fn }).find({ name: "X", titles: [{ type: "SHOW", tmdbId: "1399" }] });
    expect(urls[0]).toContain("/tv/1399/aggregate_credits");
    expect(info).toMatchObject({ biography: null, photoUrl: null, photoPageUrl: null, deathDate: "2020-01-01" });
  });

  it("renvoie null sans clé, sans titre TMDB, sans correspondance ou en cas d'erreur", async () => {
    const { fn, urls } = routes({ "/movie/27205/credits": { status: 200, body: { cast: [], crew: [] } } });
    expect(await new TmdbPersonSource({ fetch: fn }).find(hint)).toBeNull();
    expect(await new TmdbPersonSource({ apiKey: "cle", fetch: fn }).find({ name: "X", titles: [] })).toBeNull();
    expect(await new TmdbPersonSource({ apiKey: "cle", fetch: fn }).find(hint)).toBeNull();
    expect(urls).toHaveLength(1);
    const failing = (async () => { throw new Error("réseau"); }) as unknown as typeof fetch;
    expect(await new TmdbPersonSource({ apiKey: "cle", fetch: failing }).find(hint)).toBeNull();
  });
});
