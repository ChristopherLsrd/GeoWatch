import { describe, expect, it } from "vitest";
import { DEFAULT_RATING_FILTERS, isRatingListKnown, parseRatingParams, ratingSearchParams } from "./ratingParams";

describe("parseRatingParams", () => {
  it("donne les valeurs par défaut sans paramètre", () => {
    expect(parseRatingParams(new URLSearchParams())).toEqual({ filters: DEFAULT_RATING_FILTERS, after: null });
    expect(DEFAULT_RATING_FILTERS).toEqual({
      type: null,
      search: null,
      genre: null,
      yearFrom: null,
      yearTo: null,
      imdbMin: null,
      homeOnly: false,
      sort: "popular",
      advisory: {},
    });
  });

  it("lit tous les paramètres valables", () => {
    const params = new URLSearchParams(
      "type=MOVIE&q=%20star%20&genre=scf&from=1990&to=2020&imdb=7&home=1&sort=imdb&after=NDA%3D&violence=severe&nudity=none",
    );
    expect(parseRatingParams(params)).toEqual({
      after: "NDA=",
      filters: {
        type: "MOVIE",
        search: "star",
        genre: "scf",
        yearFrom: 1990,
        yearTo: 2020,
        imdbMin: 7,
        homeOnly: true,
        sort: "imdb",
        advisory: { violence: "severe", nudity: "none" },
      },
    });
  });

  it("ignore les valeurs invalides", () => {
    const params = new URLSearchParams("type=EPISODE&genre=Science&from=abc&to=3000&imdb=5&home=oui&sort=random&after=%3Cx%3E&violence=strong");
    expect(parseRatingParams(params)).toEqual({ filters: DEFAULT_RATING_FILTERS, after: null });
  });

  it("refait les mêmes paramètres, sans les valeurs par défaut", () => {
    const filters = { ...DEFAULT_RATING_FILTERS, type: "SHOW" as const, imdbMin: 8, advisory: { profanity: "mild" as const } };
    const params = ratingSearchParams(filters, "ODA=");
    expect(params.toString()).toBe("type=SHOW&imdb=8&profanity=mild&after=ODA%3D");
    expect(parseRatingParams(params)).toEqual({ filters, after: "ODA=" });
    expect(ratingSearchParams(DEFAULT_RATING_FILTERS).toString()).toBe("");
  });
});

describe("isRatingListKnown", () => {
  it("n'accepte que les classifications connues des pays couverts", () => {
    expect(isRatingListKnown("FR", "12")).toBe(true);
    expect(isRatingListKnown("US", "TV-MA")).toBe(true);
    expect(isRatingListKnown("FR", "PG")).toBe(false);
    expect(isRatingListKnown("fr", "12")).toBe(false);
  });
});
