import { describe, expect, it } from "vitest";
import type { CatalogProvider } from "@/domain/ports/CatalogProvider";
import type { TitleDetails } from "@/domain/TitleDetails";
import { GetTitle } from "./GetTitle";

const details: TitleDetails = {
  id: "tm92641",
  type: "MOVIE",
  name: "Inception",
  year: 2010,
  posterUrl: null,
  imdbId: "tt1375666",
  tmdbId: "27205",
  originalTitle: "Inception",
  originalLanguage: null,
  synopsis: null,
  runtime: null,
  releaseDate: null,
  genres: [],
  imdbScore: null,
  imdbVotes: null,
  tmdbScore: null,
  directors: [],
  cast: [],
  trailer: null,
  ageRating: null,
  advisory: null,
};

const catalog = { getTitleDetails: async (id: string) => (id === details.id ? details : null) } as unknown as CatalogProvider;

describe("GetTitle", () => {
  it("complète la fiche avec la langue originale et la bande-annonce", async () => {
    const trailer = { youtubeKey: "YoHD9XEInc0", name: "Official Trailer", language: "en" };
    const getTitle = new GetTitle(catalog, {
      extras: async (t) => (t.tmdbId === "27205" ? { originalLanguage: "en", trailer } : { originalLanguage: null, trailer: null }),
    });
    expect(await getTitle.execute("tm92641")).toMatchObject({ originalLanguage: "en", trailer });
    expect(await getTitle.execute("tm0")).toBeNull();
  });

  it("ajoute le guide parental, et s'en passe si IMDb échoue", async () => {
    const extras = { extras: async () => ({ originalLanguage: null, trailer: null }) };
    const ok = new GetTitle(catalog, extras, { advisories: async (ids) => new Map(ids.map((id) => [id, { violence: "severe" as const }])) });
    expect((await ok.execute("tm92641"))?.advisory).toEqual({ violence: "severe" });

    const failing = new GetTitle(catalog, extras, {
      advisories: async () => {
        throw new Error("IMDb a répondu 403");
      },
    });
    expect((await failing.execute("tm92641"))?.advisory).toBeNull();

    const none = new GetTitle(catalog, extras, { advisories: async () => new Map() });
    expect((await none.execute("tm92641"))?.advisory).toBeNull();
  });
});
