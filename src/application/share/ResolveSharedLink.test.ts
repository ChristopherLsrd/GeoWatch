import { describe, expect, it } from "vitest";
import type { CatalogProvider } from "@/domain/ports/CatalogProvider";
import type { ExternalTitle, ExternalTitleLookup } from "@/domain/ports/ExternalTitleLookup";
import type { LetterboxdFilm, LetterboxdFilmReader } from "@/domain/ports/LetterboxdFilmReader";
import type { TitlePathLookup } from "@/domain/ports/TitlePathLookup";
import type { Title } from "@/domain/Title";
import { ResolveSharedLink } from "./ResolveSharedLink";

const title = (over: Partial<Title> & Pick<Title, "id" | "name">): Title => ({
  type: "MOVIE", year: null, posterUrl: null, imdbId: null, tmdbId: null, originalTitle: null, ...over,
});

const SHAWSHANK: ExternalTitle = {
  type: "MOVIE", name: "Les Évadés", originalName: "The Shawshank Redemption", year: 1994, imdbId: "tt0111161", tmdbId: "278",
};
const EVADES = title({ id: "tm119206", name: "Les Évadés", year: 1994, imdbId: "tt0111161", tmdbId: "278" });

// Résultats de recherche par requête ; « null » simule une panne du catalogue.
function catalog(results: Record<string, Title[] | null>) {
  const queries: string[] = [];
  const port = {
    async searchTitles(query: string) {
      queries.push(query);
      const found = results[query];
      if (found === null) throw new Error("catalogue en panne");
      return found ?? [];
    },
  } as unknown as CatalogProvider;
  return { port, queries };
}

function lookup(byImdb: Record<string, ExternalTitle | Error>, byTmdb: Record<string, ExternalTitle> = {}): ExternalTitleLookup {
  return {
    async byImdbId(id) {
      const found = byImdb[id];
      if (found instanceof Error) throw found;
      return found ?? null;
    },
    async byTmdbId(id, type) {
      return byTmdb[`${type}:${id}`] ?? null;
    },
  };
}

const letterboxd = (film: LetterboxdFilm): LetterboxdFilmReader => ({ read: async () => film });
const paths = (ids: Record<string, string>): TitlePathLookup => ({ byPath: async (path) => ids[path] ?? null });
const NO_LETTERBOXD = letterboxd({ kind: "unreadable", slug: null });
const NO_PATHS = paths({});

describe("ResolveSharedLink", () => {
  it("IMDb : retrouve le titre dont l'identifiant IMDb correspond, dès la première recherche", async () => {
    const { port, queries } = catalog({ "Les Évadés": [title({ id: "tm1", name: "Les Évadés", year: 1994 }), EVADES] });
    const resolve = new ResolveSharedLink(port, lookup({ tt0111161: SHAWSHANK }), NO_LETTERBOXD, NO_PATHS);

    expect(await resolve.execute({ text: "https://www.imdb.com/title/tt0111161/?ref_=ext_shr" })).toEqual({ kind: "title", id: "tm119206" });
    expect(queries).toEqual(["Les Évadés"]);
  });

  it("IMDb : cherche sous le titre original quand le titre français ne donne rien", async () => {
    const { port, queries } = catalog({ "Les Évadés": [], "The Shawshank Redemption": [EVADES] });
    const resolve = new ResolveSharedLink(port, lookup({ tt0111161: SHAWSHANK }), NO_LETTERBOXD, NO_PATHS);

    expect(await resolve.execute({ url: "https://www.imdb.com/title/tt0111161/" })).toEqual({ kind: "title", id: "tm119206" });
    expect(queries).toEqual(["Les Évadés", "The Shawshank Redemption"]);
  });

  it("IMDb : sans identifiant commun, retient le titre sûr par nom et année", async () => {
    const sansIds = title({ id: "tm9", name: "Les Évadés", year: 1994 });
    const { port } = catalog({ "Les Évadés": [sansIds], "The Shawshank Redemption": [] });
    const resolve = new ResolveSharedLink(port, lookup({ tt0111161: SHAWSHANK }), NO_LETTERBOXD, NO_PATHS);

    expect(await resolve.execute({ url: "https://www.imdb.com/title/tt0111161/" })).toEqual({ kind: "title", id: "tm9" });
  });

  it("IMDb : propose les candidats en cas de doute", async () => {
    const a = title({ id: "tm1", name: "Les Évadés", year: 1994 });
    const b = title({ id: "tm2", name: "Les Évadés", year: 1995 });
    const { port } = catalog({ "Les Évadés": [a, b], "The Shawshank Redemption": [] });
    const resolve = new ResolveSharedLink(port, lookup({ tt0111161: SHAWSHANK }), NO_LETTERBOXD, NO_PATHS);

    expect(await resolve.execute({ url: "https://www.imdb.com/title/tt0111161/" })).toEqual({ kind: "candidates", candidates: [a, b] });
  });

  it("IMDb : renvoie vers la recherche du titre quand rien ne correspond", async () => {
    const { port } = catalog({});
    const resolve = new ResolveSharedLink(port, lookup({ tt0111161: SHAWSHANK }), NO_LETTERBOXD, NO_PATHS);

    expect(await resolve.execute({ url: "https://www.imdb.com/title/tt0111161/" })).toEqual({ kind: "search", query: "Les Évadés" });
  });

  it("IMDb : TMDB en panne → l'accueil, et catalogue en panne → recherche du titre", async () => {
    const tmdbDown = new ResolveSharedLink(catalog({}).port, lookup({ tt0111161: new Error("TMDB a répondu 500") }), NO_LETTERBOXD, NO_PATHS);
    expect(await tmdbDown.execute({ url: "https://www.imdb.com/title/tt0111161/" })).toEqual({ kind: "search", query: "" });

    const catalogDown = new ResolveSharedLink(
      catalog({ "Les Évadés": null, "The Shawshank Redemption": null }).port,
      lookup({ tt0111161: SHAWSHANK }),
      NO_LETTERBOXD,
      NO_PATHS,
    );
    expect(await catalogDown.execute({ url: "https://www.imdb.com/title/tt0111161/" })).toEqual({ kind: "search", query: "Les Évadés" });
  });

  it("IMDb : TMDB en panne avec du texte partagé → recherche de ce texte", async () => {
    const resolve = new ResolveSharedLink(catalog({}).port, lookup({ tt0111161: new Error("TMDB a répondu 500") }), NO_LETTERBOXD, NO_PATHS);
    expect(await resolve.execute({ text: "Les Évadés (1994) https://www.imdb.com/title/tt0111161/?ref_=ext_shr" })).toEqual({ kind: "search", query: "Les Évadés (1994)" });
  });

  it("Letterboxd injoignable sans slug, avec du texte partagé → recherche de ce texte", async () => {
    const resolve = new ResolveSharedLink(catalog({}).port, lookup({}), NO_LETTERBOXD, NO_PATHS);
    expect(await resolve.execute({ title: "Parasite", text: "https://boxd.it/abc" })).toEqual({ kind: "search", query: "Parasite" });
  });

  it("TMDB : retient la série, pas le film qui porte le même numéro TMDB", async () => {
    const show: ExternalTitle = { type: "SHOW", name: "Breaking Bad", originalName: null, year: 2008, imdbId: null, tmdbId: "1396" };
    const film = title({ id: "tm5", name: "Breaking Bad", tmdbId: "1396" });
    const serie = title({ id: "ts4", name: "Breaking Bad", type: "SHOW", tmdbId: "1396" });
    const { port } = catalog({ "Breaking Bad": [film, serie] });
    const resolve = new ResolveSharedLink(port, lookup({}, { "SHOW:1396": show }), NO_LETTERBOXD, NO_PATHS);

    expect(await resolve.execute({ url: "https://www.themoviedb.org/tv/1396" })).toEqual({ kind: "title", id: "ts4" });
  });

  it("JustWatch : ouvre directement le titre du chemin, sinon cherche le slug", async () => {
    const resolve = new ResolveSharedLink(catalog({}).port, lookup({}), NO_LETTERBOXD, paths({ "/fr/film/les-evades": "tm119206" }));

    expect(await resolve.execute({ url: "https://www.justwatch.com/fr/film/les-evades" })).toEqual({ kind: "title", id: "tm119206" });
    expect(await resolve.execute({ url: "https://www.justwatch.com/fr/film/la-ligne-verte" })).toEqual({ kind: "search", query: "la ligne verte" });
  });

  it("Letterboxd : passe par l'identifiant IMDb lu sur la page", async () => {
    const { port } = catalog({ "Les Évadés": [EVADES] });
    const page = letterboxd({ kind: "found", tmdbId: "278", imdbId: "tt0111161", slug: "the-shawshank-redemption" });
    const resolve = new ResolveSharedLink(port, lookup({ tt0111161: SHAWSHANK }), page, NO_PATHS);

    expect(await resolve.execute({ text: "https://boxd.it/abc" })).toEqual({ kind: "title", id: "tm119206" });
  });

  it("Letterboxd : à défaut d'identifiant IMDb, passe par l'identifiant TMDB du film", async () => {
    const { port } = catalog({ "Les Évadés": [EVADES] });
    const page = letterboxd({ kind: "found", tmdbId: "278", imdbId: null, slug: "the-shawshank-redemption" });
    const resolve = new ResolveSharedLink(port, lookup({}, { "MOVIE:278": SHAWSHANK }), page, NO_PATHS);

    expect(await resolve.execute({ text: "https://boxd.it/abc" })).toEqual({ kind: "title", id: "tm119206" });
  });

  it("Letterboxd illisible : cherche le titre et l'année tirés du slug", async () => {
    const parasite = title({ id: "tm7", name: "Parasite", year: 2019 });
    const { port, queries } = catalog({ parasite: [title({ id: "tm8", name: "Parasite", year: 1982 }), parasite] });
    const resolve = new ResolveSharedLink(port, lookup({}), letterboxd({ kind: "unreadable", slug: "parasite-2019" }), NO_PATHS);

    expect(await resolve.execute({ url: "https://letterboxd.com/film/parasite-2019/" })).toEqual({ kind: "title", id: "tm7" });
    expect(queries).toEqual(["parasite"]);
  });

  it("Letterboxd illisible : le nombre final peut faire partie du titre", async () => {
    const br = title({ id: "tm3", name: "Blade Runner 2049", year: 2017 });
    const { port, queries } = catalog({ "blade runner": [title({ id: "tm2", name: "Blade Runner", year: 1982 })], "blade runner 2049": [br] });
    const resolve = new ResolveSharedLink(port, lookup({}), letterboxd({ kind: "unreadable", slug: "blade-runner-2049" }), NO_PATHS);

    expect(await resolve.execute({ url: "https://letterboxd.com/film/blade-runner-2049/" })).toEqual({ kind: "title", id: "tm3" });
    expect(queries).toEqual(["blade runner", "blade runner 2049"]);
  });

  it("Letterboxd injoignable sans slug : l'accueil", async () => {
    const resolve = new ResolveSharedLink(catalog({}).port, lookup({}), NO_LETTERBOXD, NO_PATHS);
    expect(await resolve.execute({ text: "https://boxd.it/abc" })).toEqual({ kind: "search", query: "" });
  });

  it("texte sans lien reconnu : la recherche ; rien : l'accueil", async () => {
    const resolve = new ResolveSharedLink(catalog({}).port, lookup({}), NO_LETTERBOXD, NO_PATHS);
    expect(await resolve.execute({ text: "Les Évadés" })).toEqual({ kind: "search", query: "Les Évadés" });
    expect(await resolve.execute({})).toEqual({ kind: "search", query: "" });
  });
});
