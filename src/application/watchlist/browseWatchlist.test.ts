import { describe, expect, it } from "vitest";
import type { WatchlistOverviewItem } from "./WatchlistOverview";
import {
  applicableFilters,
  filterWatchlist,
  NO_SAVED_FILTERS,
  parseSavedFilters,
  sortWatchlist,
  watchlistFacets,
} from "./browseWatchlist";

const netflix = { platform: { id: "8", name: "Netflix", iconUrl: null }, country: "FR" };

function item(
  name: string,
  options: {
    type?: "MOVIE" | "SHOW";
    added?: string;
    release?: string | null;
    imdb?: number | null;
    runtime?: number | null;
    directors?: string[];
    genres?: string[];
    note?: string;
    atHome?: boolean;
    noDetails?: boolean;
  } = {},
): WatchlistOverviewItem {
  return {
    title: { id: name, type: options.type ?? "MOVIE", name, year: null, posterUrl: null, imdbId: null, tmdbId: null },
    details: options.noDetails
      ? null
      : {
          directors: options.directors ?? [],
          releaseDate: options.release ?? null,
          runtime: options.runtime ?? null,
          genres: options.genres ?? [],
          imdbScore: options.imdb ?? null,
          tmdbScore: null,
          fetchedAt: new Date(),
        },
    note: options.note ?? "",
    addedAt: new Date(options.added ?? "2026-10-01"),
    availableAtHome: options.atHome ? [netflix] : [],
    priceDrop: null,
  };
}

const items = [
  item("Inception", {
    added: "2026-10-03",
    release: "2010-07-14",
    imdb: 8.8,
    runtime: 148,
    directors: ["Christopher Nolan"],
    genres: ["Science-Fiction"],
    atHome: true,
  }),
  item("Amélie", {
    added: "2026-10-01",
    release: "2001-04-25",
    imdb: 8.3,
    runtime: 122,
    directors: ["Jean-Pierre Jeunet"],
    genres: ["Comédie"],
    note: "conseillé par Léa",
  }),
  item("Le Bureau des légendes", { type: "SHOW", added: "2026-10-02", release: "2015-04-27", genres: ["Drame"] }),
  item("Sans fiche", { added: "2026-09-01", noDetails: true }),
];

const names = (list: WatchlistOverviewItem[]) => list.map((i) => i.title.name);

describe("sortWatchlist", () => {
  it("trie dans le sens naturel, valeurs inconnues à la fin", () => {
    expect(names(sortWatchlist(items, "added"))).toEqual(["Inception", "Le Bureau des légendes", "Amélie", "Sans fiche"]);
    expect(names(sortWatchlist(items, "release"))).toEqual(["Le Bureau des légendes", "Inception", "Amélie", "Sans fiche"]);
    expect(names(sortWatchlist(items, "imdb"))).toEqual(["Inception", "Amélie", "Le Bureau des légendes", "Sans fiche"]);
    expect(names(sortWatchlist(items, "title"))).toEqual(["Amélie", "Inception", "Le Bureau des légendes", "Sans fiche"]);
    expect(names(sortWatchlist(items, "runtime"))).toEqual(["Amélie", "Inception", "Le Bureau des légendes", "Sans fiche"]);
  });

  it("inverse le sens en gardant les valeurs inconnues à la fin", () => {
    expect(names(sortWatchlist(items, "imdb", true))).toEqual(["Amélie", "Inception", "Le Bureau des légendes", "Sans fiche"]);
  });
});

describe("filterWatchlist", () => {
  it("cherche dans le titre, les réalisateurs et la note, sans tenir compte des accents", () => {
    expect(names(filterWatchlist(items, { query: "amelie" }))).toEqual(["Amélie"]);
    expect(names(filterWatchlist(items, { query: "nolan" }))).toEqual(["Inception"]);
    expect(names(filterWatchlist(items, { query: "LEA" }))).toEqual(["Amélie"]);
  });

  it("filtre par type, réalisateur, genre et disponibilité chez moi", () => {
    expect(names(filterWatchlist(items, { type: "SHOW" }))).toEqual(["Le Bureau des légendes"]);
    expect(names(filterWatchlist(items, { directors: ["Jean-Pierre Jeunet"] }))).toEqual(["Amélie"]);
    expect(names(filterWatchlist(items, { genres: ["Drame", "Comédie"] }))).toEqual(["Amélie", "Le Bureau des légendes"]);
    expect(names(filterWatchlist(items, { atHomeOnly: true }))).toEqual(["Inception"]);
  });

  it("propose les réalisateurs et les genres présents", () => {
    expect(watchlistFacets(items)).toEqual({
      directors: ["Christopher Nolan", "Jean-Pierre Jeunet"],
      genres: ["Comédie", "Drame", "Science-Fiction"],
    });
  });
});

describe("parseSavedFilters", () => {
  it("relit des filtres enregistrés", () => {
    const saved = { type: "SHOW", director: "Christopher Nolan", genre: "Drame", atHomeOnly: true };
    expect(parseSavedFilters(JSON.stringify(saved))).toEqual(saved);
  });

  it("revient aux filtres par défaut si la valeur est absente ou illisible", () => {
    expect(parseSavedFilters(null)).toEqual(NO_SAVED_FILTERS);
    expect(parseSavedFilters("{pas du json")).toEqual(NO_SAVED_FILTERS);
    expect(parseSavedFilters("42")).toEqual(NO_SAVED_FILTERS);
  });

  it("ignore les champs invalides un par un", () => {
    const raw = JSON.stringify({ type: "FILM", director: 3, genre: "Drame", atHomeOnly: "oui" });
    expect(parseSavedFilters(raw)).toEqual({ ...NO_SAVED_FILTERS, genre: "Drame" });
  });
});

describe("applicableFilters", () => {
  const facets = watchlistFacets(items);

  it("garde les valeurs encore présentes dans la liste", () => {
    const saved = { type: "MOVIE" as const, director: "Christopher Nolan", genre: "Drame", atHomeOnly: true };
    expect(applicableFilters(saved, facets)).toEqual(saved);
  });

  it("met de côté un réalisateur ou un genre qui n'est plus dans la liste", () => {
    const saved = { ...NO_SAVED_FILTERS, director: "Agnès Varda", genre: "Western" };
    expect(applicableFilters(saved, facets)).toEqual(NO_SAVED_FILTERS);
  });
});
