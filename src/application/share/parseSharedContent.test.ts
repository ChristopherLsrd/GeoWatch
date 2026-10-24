import { describe, expect, it } from "vitest";
import { parseSharedContent } from "./parseSharedContent";

describe("parseSharedContent", () => {
  it("reconnaît un lien IMDb, avec www, m. ou une langue, et ignore les paramètres de suivi", () => {
    expect(parseSharedContent({ text: "https://www.imdb.com/title/tt27419420/?ref_=ext_shr" })).toEqual({ kind: "imdb", imdbId: "tt27419420" });
    expect(parseSharedContent({ url: "https://m.imdb.com/title/tt0903747/" })).toEqual({ kind: "imdb", imdbId: "tt0903747" });
    expect(parseSharedContent({ url: "https://www.imdb.com/fr/title/tt0111161" })).toEqual({ kind: "imdb", imdbId: "tt0111161" });
  });

  it("reconnaît un lien TMDB de film ou de série", () => {
    expect(parseSharedContent({ url: "https://www.themoviedb.org/movie/278-the-shawshank-redemption?language=fr" })).toEqual({ kind: "tmdb", tmdbId: "278", type: "MOVIE" });
    expect(parseSharedContent({ url: "https://www.themoviedb.org/tv/1396" })).toEqual({ kind: "tmdb", tmdbId: "1396", type: "SHOW" });
  });

  it("garde les trois premiers segments d'un chemin JustWatch, quel que soit le pays", () => {
    expect(parseSharedContent({ url: "https://www.justwatch.com/fr/film/les-evades" })).toEqual({ kind: "justwatch", path: "/fr/film/les-evades" });
    expect(parseSharedContent({ url: "https://www.justwatch.com/fr/serie/breaking-bad/saison-2" })).toEqual({ kind: "justwatch", path: "/fr/serie/breaking-bad" });
  });

  it("reconnaît un lien Letterboxd court, ou la page d'un film, même depuis le journal d'un membre", () => {
    expect(parseSharedContent({ title: "", text: "https://boxd.it/RTVm", url: "" })).toEqual({ kind: "letterboxd", url: "https://boxd.it/RTVm" });
    expect(parseSharedContent({ url: "https://letterboxd.com/film/parasite-2019/" })).toEqual({ kind: "letterboxd", url: "https://letterboxd.com/film/parasite-2019/" });
    expect(parseSharedContent({ url: "https://letterboxd.com/chris/film/parasite-2019/1/" })).toEqual({ kind: "letterboxd", url: "https://letterboxd.com/film/parasite-2019/" });
  });

  it("cherche le lien dans url, puis text, puis title, et retire la ponctuation collée à la fin", () => {
    expect(parseSharedContent({ text: "Regarde ça : https://boxd.it/RTVm." })).toEqual({ kind: "letterboxd", url: "https://boxd.it/RTVm" });
    expect(parseSharedContent({ title: "https://www.imdb.com/title/tt0111161/" })).toEqual({ kind: "imdb", imdbId: "tt0111161" });
  });

  it("renvoie le texte sans le lien quand le lien n'est pas reconnu, ou le titre à défaut", () => {
    expect(parseSharedContent({ text: "Les Évadés https://exemple.fr/film" })).toEqual({ kind: "query", query: "Les Évadés" });
    expect(parseSharedContent({ title: "Parasite", text: "https://exemple.fr/x" })).toEqual({ kind: "query", query: "Parasite" });
    expect(parseSharedContent({ text: "  Dune   deuxième partie " })).toEqual({ kind: "query", query: "Dune deuxième partie" });
  });

  it("ne garde rien d'un lien IMDb qui n'est pas une fiche de titre", () => {
    expect(parseSharedContent({ url: "https://www.imdb.com/name/nm0001104/" })).toEqual({ kind: "empty" });
  });

  it("renvoie « vide » sans contenu exploitable", () => {
    expect(parseSharedContent({})).toEqual({ kind: "empty" });
    expect(parseSharedContent({ title: " ", text: "", url: "" })).toEqual({ kind: "empty" });
    expect(parseSharedContent({ text: "https://exemple.fr/x" })).toEqual({ kind: "empty" });
  });
});
