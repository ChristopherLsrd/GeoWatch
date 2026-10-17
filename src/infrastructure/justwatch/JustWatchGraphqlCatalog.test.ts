import { describe, expect, it } from "vitest";
import { CatalogUnavailableError } from "@/domain/ports/CatalogProvider";
import { JustWatchGraphqlCatalog } from "./JustWatchGraphqlCatalog";

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
      },
    ]);
  });

  it("convertit les résultats de recherche et ignore ce qui n'est ni un film ni une série", async () => {
    const node = {
      id: "tm92641",
      objectType: "MOVIE",
      content: {
        title: "Inception",
        originalReleaseYear: 2010,
        posterUrl: "/poster/8716170/s332/inception.jpg",
        externalIds: { imdbId: "tt1375666", tmdbId: "27205" },
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
        year: 2010,
        posterUrl: "https://images.justwatch.com/poster/8716170/s332/inception.jpg",
        imdbId: "tt1375666",
        tmdbId: "27205",
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
