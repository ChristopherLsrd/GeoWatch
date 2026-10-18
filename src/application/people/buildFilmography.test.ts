import { describe, expect, it } from "vitest";
import type { FilmographyEntry } from "@/domain/Person";
import type { Subscription } from "@/domain/Subscription";
import { buildFilmography, toCards } from "./buildFilmography";

function entry(id: string, year: number | null, extra: Partial<FilmographyEntry> = {}): FilmographyEntry {
  return {
    id,
    type: "MOVIE",
    name: `Titre ${id}`,
    year,
    posterUrl: null,
    imdbId: null,
    tmdbId: null,
    runtime: null,
    imdbScore: null,
    tmdbScore: null,
    flatrate: {},
    ...extra,
  };
}

describe("buildFilmography", () => {
  it("retire les doublons FR/US en gardant la première occurrence, et trie par année décroissante", () => {
    const filmography = buildFilmography({
      DIRECTOR: [entry("tm1", 2010, { name: "Inception" }), entry("tm2", 2014), entry("tm1", 2010, { name: "Inception (US)" }), entry("tm3", 2023)],
      ACTOR: [],
      ALL: [],
    });
    expect(filmography.DIRECTOR.map((e) => e.id)).toEqual(["tm3", "tm2", "tm1"]);
    expect(filmography.DIRECTOR[2].name).toBe("Inception");
  });

  it("met les années inconnues à la fin", () => {
    const filmography = buildFilmography({ DIRECTOR: [entry("tm1", null), entry("tm2", 2000)], ACTOR: [], ALL: [] });
    expect(filmography.DIRECTOR.map((e) => e.id)).toEqual(["tm2", "tm1"]);
  });

  it("garde dans « Autres » les titres absents de Réalisation et d'Interprétation", () => {
    const filmography = buildFilmography({
      DIRECTOR: [entry("tm1", 2010)],
      ACTOR: [entry("tm2", 2012)],
      ALL: [entry("tm1", 2010), entry("tm2", 2012), entry("tm3", 2013), entry("tm3", 2013)],
    });
    expect(filmography.OTHER.map((e) => e.id)).toEqual(["tm3"]);
    expect(filmography.ACTOR.map((e) => e.id)).toEqual(["tm2"]);
  });
});

describe("toCards", () => {
  const netflix = { id: "8", name: "Netflix", iconUrl: null };
  const canal = { id: "381", name: "Canal+", iconUrl: null };
  const subscriptions: Subscription[] = [
    { platform: netflix, country: "FR" },
    { platform: canal, country: "FR" },
  ];

  it("calcule le badge « Chez moi » avec les abonnements et retire les offres brutes", () => {
    const filmography = buildFilmography({
      DIRECTOR: [entry("tm1", 2010, { flatrate: { FR: ["8", "119"] } }), entry("tm2", 2011, { flatrate: { BE: ["8"] } })],
      ACTOR: [],
      ALL: [],
    });
    const cards = toCards(filmography, subscriptions);
    expect(cards.DIRECTOR[0].availableAtHome).toEqual([]);
    expect(cards.DIRECTOR[1].availableAtHome).toEqual([{ platform: netflix, country: "FR" }]);
    expect("flatrate" in cards.DIRECTOR[1]).toBe(false);
    expect(cards.ACTOR).toEqual([]);
    expect(cards.OTHER).toEqual([]);
  });
});
