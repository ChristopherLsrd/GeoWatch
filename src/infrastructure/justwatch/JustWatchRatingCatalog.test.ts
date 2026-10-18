import { describe, expect, it } from "vitest";
import { CatalogUnavailableError } from "@/domain/ports/CatalogProvider";
import type { RatingQuery } from "@/domain/ports/RatingCatalog";
import { JustWatchRatingCatalog } from "./JustWatchRatingCatalog";

type Call = { operationName?: string; query: string; variables: Record<string, unknown> };

// Une réponse par appel, dans l'ordre.
function sequenceFetch(bodies: unknown[], status = 200) {
  const calls: Call[] = [];
  const fn = (async (_url: string, init: RequestInit) => {
    calls.push(JSON.parse(String(init.body)));
    return new Response(JSON.stringify(bodies[calls.length - 1]), { status });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const base: RatingQuery = {
  country: "FR",
  code: "12",
  type: null,
  search: null,
  genre: null,
  yearFrom: null,
  yearTo: null,
  imdbMin: null,
  homeOnly: false,
  sort: "popular",
  after: null,
};

const node = {
  id: "tm1",
  objectType: "MOVIE",
  content: {
    title: "Inception",
    originalTitle: "Inception",
    originalReleaseYear: 2010,
    runtime: 148,
    posterUrl: null,
    externalIds: { imdbId: "tt1375666", tmdbId: "27205" },
    scoring: { imdbScore: 8.8, tmdbScore: 8.4 },
  },
};

const page = (hasNextPage: boolean) => ({
  data: { popularTitles: { totalCount: 8330, pageInfo: { endCursor: "NDA=", hasNextPage }, edges: [{ node }, { node: { ...node, id: "ts1", objectType: "SHOW_SEASON" } }] } },
});

describe("JustWatchRatingCatalog", () => {
  it("demande la classification avec les valeurs par défaut et convertit la page", async () => {
    const { fn, calls } = sequenceFetch([page(true)]);
    const result = await new JustWatchRatingCatalog({ fetch: fn }).list(base, []);

    expect(calls).toHaveLength(1);
    expect(calls[0].variables).toEqual({
      country: "FR",
      first: 40,
      after: null,
      sortBy: "POPULAR",
      filter: { ageCertifications: ["12"], objectTypes: ["MOVIE", "SHOW"] },
    });
    expect(result).toEqual({
      total: 8330,
      nextCursor: "NDA=",
      titles: [
        {
          id: "tm1",
          type: "MOVIE",
          name: "Inception",
          originalTitle: "Inception",
          year: 2010,
          posterUrl: null,
          imdbId: "tt1375666",
          tmdbId: "27205",
          runtime: 148,
          imdbScore: 8.8,
          tmdbScore: 8.4,
        },
      ],
    });
  });

  it("transmet les filtres, le tri et le curseur, et n'a pas de page suivante en fin de liste", async () => {
    const { fn, calls } = sequenceFetch([page(false)]);
    const result = await new JustWatchRatingCatalog({ fetch: fn }).list(
      { ...base, type: "SHOW", search: "star", genre: "scf", yearFrom: 1990, yearTo: 2020, imdbMin: 7, sort: "imdb", after: "NDA=" },
      [],
    );
    expect(calls[0].variables).toMatchObject({
      after: "NDA=",
      sortBy: "IMDB_SCORE",
      filter: {
        ageCertifications: ["12"],
        objectTypes: ["SHOW"],
        searchQuery: "star",
        genres: ["scf"],
        releaseYear: { min: 1990, max: 2020 },
        imdbScore: { min: 7 },
      },
    });
    expect(result.nextCursor).toBeNull();
  });

  it("fait correspondre les tris", async () => {
    for (const [sort, sortBy] of [["year", "RELEASE_YEAR"], ["alpha", "ALPHABETICAL"]] as const) {
      const { fn, calls } = sequenceFetch([page(false)]);
      await new JustWatchRatingCatalog({ fetch: fn }).list({ ...base, sort }, []);
      expect(calls[0].variables.sortBy).toBe(sortBy);
    }
  });

  it("filtre « Chez moi » avec les codes courts des plateformes, gardés en mémoire", async () => {
    const packages = { data: { packages: [{ packageId: 8, shortName: "nfx" }, { packageId: 119, shortName: "prv" }] } };
    const { fn, calls } = sequenceFetch([packages, page(false), page(false)]);
    const catalog = new JustWatchRatingCatalog({ fetch: fn });
    await catalog.list({ ...base, homeOnly: true }, ["8", "999"]);
    await catalog.list({ ...base, homeOnly: true }, ["8"]);

    expect(calls).toHaveLength(3);
    expect(calls[0].variables).toEqual({ country: "FR" });
    expect(calls[1].variables.filter).toMatchObject({ packages: ["nfx"], monetizationTypes: ["FLATRATE"] });
  });

  it("renvoie une page vide, sans requête de titres, si aucune plateforme d'abonnement n'est connue", async () => {
    const { fn, calls } = sequenceFetch([{ data: { packages: [] } }]);
    expect(await new JustWatchRatingCatalog({ fetch: fn }).list({ ...base, homeOnly: true }, ["8"])).toEqual({
      titles: [],
      total: 0,
      nextCursor: null,
    });
    expect(calls).toHaveLength(1);
  });

  it("liste les genres en français, triés, gardés en mémoire", async () => {
    const { fn, calls } = sequenceFetch([
      { data: { genres: [{ shortName: "wsn", translation: "Western" }, { shortName: "act", translation: "Action & Aventure" }, { shortName: "x", translation: null }] } },
    ]);
    const catalog = new JustWatchRatingCatalog({ fetch: fn });
    expect(await catalog.genres()).toEqual([
      { code: "act", label: "Action & Aventure" },
      { code: "wsn", label: "Western" },
    ]);
    await catalog.genres();
    expect(calls).toHaveLength(1);
  });

  it("signale le catalogue indisponible", async () => {
    const { fn } = sequenceFetch([{}], 429);
    await expect(new JustWatchRatingCatalog({ fetch: fn }).list(base, [])).rejects.toBeInstanceOf(CatalogUnavailableError);
  });
});
