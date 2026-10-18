import { describe, expect, it } from "vitest";
import { CatalogUnavailableError } from "@/domain/ports/CatalogProvider";
import { JustWatchGraphqlCatalog, pickAgeRating } from "./JustWatchGraphqlCatalog";

function fakeFetch(status: number, body: unknown) {
  const calls: { query: string; variables: Record<string, unknown> }[] = [];
  const fn = (async (_url: string, init: RequestInit) => {
    calls.push(JSON.parse(String(init.body)));
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const jwOffer = {
  monetizationType: "FLATRATE",
  presentationType: "_4K",
  retailPrice: null,
  retailPriceValue: null,
  currency: "EUR",
  package: { packageId: 8, clearName: "Netflix", icon: "/icon/207360008/s100/netflix.png" },
  standardWebURL: "https://www.netflix.com/title/70131314",
  deeplinkURL: "https://www.netflix.com/watch/70131314?a=1&amp;b=2",
  audioLanguages: ["fr", "en"],
  subtitleLanguages: null,
};

describe("JustWatchGraphqlCatalog", () => {
  it("convertit les offres et demande tous les pays en une requête", async () => {
    const { fn, calls } = fakeFetch(200, {
      data: { node: { FR: [jwOffer, { ...jwOffer, monetizationType: "CINEMA" }], BE: null } },
    });
    const offers = await new JustWatchGraphqlCatalog({ fetch: fn }).getOffers("tm92641", ["FR", "BE"]);

    expect(calls).toHaveLength(1);
    expect(calls[0].query).toContain("FR: offers(country: FR");
    expect(calls[0].query).toContain("BE: offers(country: BE");
    expect(offers.BE).toEqual([]);
    expect(offers.FR).toEqual([
      {
        country: "FR",
        platform: { id: "8", name: "Netflix", iconUrl: "https://images.justwatch.com/icon/207360008/s100/netflix.png" },
        monetizationType: "FLATRATE",
        quality: "4K",
        price: null,
        priceValue: null,
        currency: "EUR",
        audioLanguages: ["fr", "en"],
        subtitleLanguages: [],
        url: "https://www.netflix.com/title/70131314",
        deepLinkUrl: "https://www.netflix.com/watch/70131314?a=1&b=2",
      },
    ]);
  });

  it("convertit la fiche complète d'un titre", async () => {
    const { fn, calls } = fakeFetch(200, {
      data: {
        node: {
          id: "tm92641",
          objectType: "MOVIE",
          content: { title: "Inception", originalReleaseYear: 2010, posterUrl: null, externalIds: { imdbId: "tt1375666", tmdbId: "27205" } },
          ratingFR: { ageCertification: "" },
          ratingUS: { ageCertification: "PG-13" },
          details: {
            originalTitle: "Inception",
            shortDescription: " Dom Cobb est un voleur. ",
            runtime: 148,
            originalReleaseDate: "2010-07-14",
            genres: [{ translation: "Action & Aventure" }, { translation: null }],
            scoring: { imdbScore: 8.8, imdbVotes: 2880387, tmdbScore: 8.373 },
            credits: [
              { role: "ACTOR", name: "Leonardo DiCaprio", characterName: "Dom Cobb", personId: 1641 },
              { role: "DIRECTOR", name: "Christopher Nolan", characterName: "", personId: 1725 },
              { role: "ACTOR", name: "Elliot Page", characterName: "" },
            ],
          },
        },
      },
    });
    const title = await new JustWatchGraphqlCatalog({ fetch: fn }).getTitleDetails("tm92641");
    expect(calls[0].variables).toMatchObject({ nodeId: "tm92641", country: "FR", language: "fr" });
    expect(calls[0].query).toContain("ratingFR: content(country: FR");
    expect(title).toEqual({
      id: "tm92641",
      type: "MOVIE",
      name: "Inception",
      year: 2010,
      posterUrl: null,
      imdbId: "tt1375666",
      tmdbId: "27205",
      originalTitle: "Inception",
      originalLanguage: null,
      trailer: null,
      ageRating: { country: "US", code: "PG-13" },
      advisory: null,
      synopsis: "Dom Cobb est un voleur.",
      runtime: 148,
      releaseDate: "2010-07-14",
      genres: ["Action & Aventure"],
      imdbScore: 8.8,
      imdbVotes: 2880387,
      tmdbScore: 8.373,
      directors: ["Christopher Nolan"],
      directorRefs: [],
      cast: [
        { name: "Leonardo DiCaprio", character: "Dom Cobb", personId: "tp1641" },
        { name: "Elliot Page", character: null, personId: null },
      ],
    });
  });

  it("choisit la classification française, sinon américaine", () => {
    expect(pickAgeRating("12", "PG-13")).toEqual({ country: "FR", code: "12" });
    expect(pickAgeRating(" ", "PG-13")).toEqual({ country: "US", code: "PG-13" });
    expect(pickAgeRating(null, undefined)).toBeNull();
  });

  it("donne les identifiants des réalisateurs et des acteurs", async () => {
    const { fn, calls } = fakeFetch(200, {
      data: {
        node: {
          id: "tm92641",
          objectType: "MOVIE",
          content: {
            title: "Inception",
            originalReleaseYear: 2010,
            posterUrl: null,
            externalIds: null,
            directors: [{ name: "Christopher Nolan", personId: 1725 }],
          },
          details: {
            originalTitle: "Inception",
            shortDescription: null,
            runtime: 148,
            originalReleaseDate: null,
            genres: [],
            scoring: null,
            credits: [
              { role: "DIRECTOR", name: "Christopher Nolan", characterName: null, personId: 1725 },
              { role: "ACTOR", name: "Leonardo DiCaprio", characterName: "Cobb", personId: 1641 },
              { role: "ACTOR", name: "Inconnu", characterName: null },
            ],
          },
        },
      },
    });
    const title = await new JustWatchGraphqlCatalog({ fetch: fn }).getTitleDetails("tm92641");
    expect(calls[0].query).toContain("credits(role: DIRECTOR) { name personId }");
    expect(calls[0].query).toContain("credits { role name characterName personId }");
    expect(title?.directors).toEqual(["Christopher Nolan"]);
    expect(title?.directorRefs).toEqual([{ id: "tp1725", name: "Christopher Nolan" }]);
    expect(title?.cast).toEqual([
      { name: "Leonardo DiCaprio", character: "Cobb", personId: "tp1641" },
      { name: "Inconnu", character: null, personId: null },
    ]);
  });

  it("convertit les résultats de recherche et ignore ce qui n'est ni un film ni une série", async () => {
    const node = {
      id: "tm92641",
      objectType: "MOVIE",
      content: {
        title: "Inception",
        originalTitle: "Inception",
        originalReleaseYear: 2010,
        posterUrl: "/poster/8716170/s332/inception.jpg",
        externalIds: { imdbId: "tt1375666", tmdbId: "27205" },
        directors: [{ name: "Christopher Nolan", personId: 1725 }],
      },
    };
    const { fn } = fakeFetch(200, {
      data: { popularTitles: { edges: [{ node }, { node: { ...node, id: "x", objectType: "EPISODE" } }] } },
    });
    expect(await new JustWatchGraphqlCatalog({ fetch: fn }).searchTitles("inception")).toEqual([
      {
        id: "tm92641",
        type: "MOVIE",
        name: "Inception",
        originalTitle: "Inception",
        year: 2010,
        posterUrl: "https://images.justwatch.com/poster/8716170/s332/inception.jpg",
        imdbId: "tt1375666",
        tmdbId: "27205",
        directors: ["Christopher Nolan"],
        directorRefs: [{ id: "tp1725", name: "Christopher Nolan" }],
      },
    ]);
  });

  it("liste les plateformes d'abonnement du pays, triées, et garde la liste en mémoire", async () => {
    const { fn, calls } = fakeFetch(200, {
      data: {
        packages: [
          { packageId: 8, clearName: "Netflix", monetizationTypes: ["FLATRATE"], icon: "/icon/1/s100/netflix.png" },
          { packageId: 2, clearName: "Apple TV Store", monetizationTypes: ["RENT", "BUY"], icon: null },
          { packageId: 381, clearName: "Canal+", monetizationTypes: ["FLATRATE", "ADS"], icon: null },
        ],
      },
    });
    const catalog = new JustWatchGraphqlCatalog({ fetch: fn });
    const platforms = await catalog.listSubscriptionPlatforms("FR");
    await catalog.listSubscriptionPlatforms("FR");

    expect(platforms).toEqual([
      { id: "381", name: "Canal+", iconUrl: null },
      { id: "8", name: "Netflix", iconUrl: "https://images.justwatch.com/icon/1/s100/netflix.png" },
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0].variables).toEqual({ country: "FR" });
  });

  it.each([429, 403, 503])("signale le catalogue indisponible sur un HTTP %i", async (status) => {
    const { fn } = fakeFetch(status, {});
    await expect(new JustWatchGraphqlCatalog({ fetch: fn }).getOffers("tm1", ["FR"])).rejects.toBeInstanceOf(
      CatalogUnavailableError,
    );
  });

  it("signale le catalogue indisponible si le réseau échoue", async () => {
    const fn = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    await expect(new JustWatchGraphqlCatalog({ fetch: fn }).searchTitles("x")).rejects.toBeInstanceOf(
      CatalogUnavailableError,
    );
  });
});
