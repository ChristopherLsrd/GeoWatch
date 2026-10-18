import { describe, expect, it } from "vitest";
import { CatalogUnavailableError } from "@/domain/ports/CatalogProvider";
import { JustWatchPersonCatalog } from "./JustWatchPersonCatalog";

function fakeFetch(status: number, body: unknown) {
  const calls: { query: string; variables: Record<string, unknown> }[] = [];
  const fn = (async (_url: string, init: RequestInit) => {
    calls.push(JSON.parse(String(init.body)));
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

function jwNode(id: string, title: string, extra: Record<string, unknown> = {}) {
  return {
    node: {
      id,
      objectType: "MOVIE",
      content: {
        title,
        originalTitle: title,
        originalReleaseYear: 2010,
        runtime: 148,
        posterUrl: "/poster/1/s332/x.jpg",
        externalIds: { imdbId: "tt1375666", tmdbId: "27205" },
        scoring: { imdbScore: 8.8, tmdbScore: 8.4 },
      },
      ...extra,
    },
  };
}

const emptyList = { edges: [] };

describe("JustWatchPersonCatalog", () => {
  it("demande la fiche et les six listes en une requête, avec les offres des pays d'abonnement", async () => {
    const { fn, calls } = fakeFetch(200, {
      data: {
        node: {
          id: "tp1725",
          fr: { fullName: "Christopher Nolan", portraitUrl: null, dateOfBirth: "1970-07-30", shortDescription: "Bio EN" },
          en: { shortDescription: "Bio EN" },
        },
        DIRECTOR_FR: { edges: [jwNode("tm92641", "Inception", { flatrate_FR: [{ package: { packageId: 8 } }, { package: { packageId: 8 } }] })] },
        DIRECTOR_US: { edges: [jwNode("tm92641", "Inception", { flatrate_FR: [] })] },
        ACTOR_FR: emptyList,
        ACTOR_US: emptyList,
        ALL_FR: { edges: [jwNode("tm1", "Man of Steel"), { node: { id: "ts1", objectType: "SHOW_SEASON", content: null } }] },
        ALL_US: emptyList,
      },
    });
    const result = await new JustWatchPersonCatalog({ fetch: fn }).getPerson("tp1725", ["FR"]);

    expect(calls).toHaveLength(1);
    expect(calls[0].variables).toMatchObject({
      nodeId: "tp1725",
      directorFilter: { personId: "tp1725", personRole: "DIRECTOR" },
      actorFilter: { personId: "tp1725", personRole: "ACTOR" },
      allFilter: { personId: "tp1725" },
    });
    for (const alias of ["DIRECTOR_FR", "DIRECTOR_US", "ACTOR_FR", "ACTOR_US", "ALL_FR", "ALL_US"]) {
      expect(calls[0].query).toContain(`${alias}: popularTitles(`);
    }
    expect(calls[0].query).toContain("flatrate_FR: offers(country: FR, platform: WEB");
    expect(result?.person).toEqual({
      id: "tp1725",
      name: "Christopher Nolan",
      birthDate: "1970-07-30",
      photoUrl: null,
      biographyFr: "Bio EN",
      biographyEn: "Bio EN",
    });
    expect(result?.filmography.DIRECTOR).toHaveLength(2);
    expect(result?.filmography.DIRECTOR[0]).toEqual({
      id: "tm92641",
      type: "MOVIE",
      name: "Inception",
      originalTitle: "Inception",
      year: 2010,
      posterUrl: "https://images.justwatch.com/poster/1/s332/x.jpg",
      imdbId: "tt1375666",
      tmdbId: "27205",
      runtime: 148,
      imdbScore: 8.8,
      tmdbScore: 8.4,
      flatrate: { FR: ["8"] },
    });
    expect(result?.filmography.ALL.map((e) => e.id)).toEqual(["tm1"]);
  });

  it("n'ajoute aucune offre sans pays d'abonnement, et ignore les codes de pays invalides", async () => {
    const { fn, calls } = fakeFetch(200, {
      data: {
        node: { id: "tp1", fr: { fullName: "X", portraitUrl: null, dateOfBirth: null, shortDescription: null }, en: null },
        DIRECTOR_FR: emptyList, DIRECTOR_US: emptyList, ACTOR_FR: emptyList, ACTOR_US: emptyList, ALL_FR: emptyList, ALL_US: emptyList,
      },
    });
    await new JustWatchPersonCatalog({ fetch: fn }).getPerson("tp1", ["XX" as never]);
    expect(calls[0].query).not.toContain("offers(");
  });

  it("renvoie null pour une personne inconnue", async () => {
    const { fn } = fakeFetch(200, {
      data: { node: { id: "tp999" }, DIRECTOR_FR: emptyList, DIRECTOR_US: emptyList, ACTOR_FR: emptyList, ACTOR_US: emptyList, ALL_FR: emptyList, ALL_US: emptyList },
    });
    expect(await new JustWatchPersonCatalog({ fetch: fn }).getPerson("tp999", [])).toBeNull();
  });

  it("renvoie null quand JustWatch ne trouve pas l'identifiant (réponse réelle du 2026-10-18)", async () => {
    const { fn } = fakeFetch(200, {
      errors: [
        {
          message: "resolver.findMergedTitle: no merge target found for tp999999999",
          path: ["node", "content"],
          extensions: { code: "INTERNAL_ERROR" },
        },
      ],
      data: { node: null, DIRECTOR_FR: emptyList, DIRECTOR_US: emptyList, ACTOR_FR: emptyList, ACTOR_US: emptyList, ALL_FR: emptyList, ALL_US: emptyList },
    });
    expect(await new JustWatchPersonCatalog({ fetch: fn }).getPerson("tp999999999", [])).toBeNull();
  });

  it("signale les autres erreurs GraphQL", async () => {
    const { fn } = fakeFetch(200, { errors: [{ message: "Cannot query field" }], data: null });
    await expect(new JustWatchPersonCatalog({ fetch: fn }).getPerson("tp1", [])).rejects.toThrow(/inattendue/);
  });

  it("signale une limitation de JustWatch", async () => {
    const { fn } = fakeFetch(429, {});
    await expect(new JustWatchPersonCatalog({ fetch: fn }).getPerson("tp1", [])).rejects.toBeInstanceOf(CatalogUnavailableError);
  });
});
