import { describe, expect, it } from "vitest";
import { LetterboxdHttpReader } from "./LetterboxdHttpReader";

type Reply = { status: number; location?: string; body?: string };

// Une réponse par URL demandée ; une URL absente fait échouer la requête (réseau).
function fakeFetch(replies: Record<string, Reply>) {
  const urls: string[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    urls.push(url);
    expect(init.redirect).toBe("manual");
    const reply = replies[url];
    if (!reply) throw new TypeError("fetch failed");
    return new Response(reply.body ?? "", { status: reply.status, headers: reply.location ? { location: reply.location } : {} });
  }) as unknown as typeof fetch;
  return { fn, urls };
}

const FILM_PAGE = `<body class="film" data-tmdb-id="1400940" data-tmdb-type="movie">
  <a href="http://www.imdb.com/title/tt34890576/maindetails" data-track-action="IMDb">IMDb</a></body>`;

describe("LetterboxdHttpReader", () => {
  it("suit le lien court jusqu'à la page du film et lit ses identifiants", async () => {
    const { fn, urls } = fakeFetch({
      "https://boxd.it/RTVm": { status: 302, location: "https://letterboxd.com/film/clayface/" },
      "https://letterboxd.com/film/clayface/": { status: 200, body: FILM_PAGE },
    });
    expect(await new LetterboxdHttpReader(fn).read("https://boxd.it/RTVm")).toEqual({
      kind: "found", tmdbId: "1400940", imdbId: "tt34890576", slug: "clayface",
    });
    expect(urls).toEqual(["https://boxd.it/RTVm", "https://letterboxd.com/film/clayface/"]);
  });

  it("refuse de suivre une redirection hors de Letterboxd", async () => {
    const { fn, urls } = fakeFetch({ "https://boxd.it/x": { status: 302, location: "https://exemple.fr/piege" } });
    expect(await new LetterboxdHttpReader(fn).read("https://boxd.it/x")).toEqual({ kind: "unreadable", slug: null });
    expect(urls).toEqual(["https://boxd.it/x"]);
  });

  it("s'arrête après 3 redirections", async () => {
    const { fn, urls } = fakeFetch({
      "https://boxd.it/a": { status: 302, location: "https://boxd.it/b" },
      "https://boxd.it/b": { status: 302, location: "https://boxd.it/c" },
      "https://boxd.it/c": { status: 302, location: "https://boxd.it/d" },
      "https://boxd.it/d": { status: 302, location: "https://boxd.it/e" },
    });
    expect(await new LetterboxdHttpReader(fn).read("https://boxd.it/a")).toEqual({ kind: "unreadable", slug: null });
    expect(urls).toHaveLength(4);
  });

  it("garde le slug quand la page est bloquée", async () => {
    const { fn } = fakeFetch({ "https://letterboxd.com/film/parasite-2019/": { status: 403, body: "<title>Just a moment...</title>" } });
    expect(await new LetterboxdHttpReader(fn).read("https://letterboxd.com/film/parasite-2019/")).toEqual({
      kind: "unreadable", slug: "parasite-2019",
    });
  });

  it("garde le slug quand la page ne contient aucun identifiant", async () => {
    const { fn } = fakeFetch({ "https://letterboxd.com/film/dune-part-two/": { status: 200, body: "<html></html>" } });
    expect(await new LetterboxdHttpReader(fn).read("https://letterboxd.com/film/dune-part-two/")).toEqual({
      kind: "unreadable", slug: "dune-part-two",
    });
  });

  it("ne lève pas quand Letterboxd est injoignable", async () => {
    const { fn } = fakeFetch({});
    expect(await new LetterboxdHttpReader(fn).read("https://letterboxd.com/film/clayface/")).toEqual({ kind: "unreadable", slug: "clayface" });
  });

  it("ne lève pas pour une adresse invalide, sans appeler Letterboxd", async () => {
    const { fn, urls } = fakeFetch({});
    expect(await new LetterboxdHttpReader(fn).read("pas une url")).toEqual({ kind: "unreadable", slug: null });
    expect(urls).toHaveLength(0);
  });

  it("refuse une adresse Letterboxd avec un port explicite", async () => {
    const { fn, urls } = fakeFetch({});
    expect(await new LetterboxdHttpReader(fn).read("https://letterboxd.com:8443/film/x/")).toEqual({ kind: "unreadable", slug: "x" });
    expect(urls).toHaveLength(0);
  });
});
