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
  imdbId: null,
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
};

const catalog = { getTitleDetails: async (id: string) => (id === details.id ? details : null) } as unknown as CatalogProvider;

describe("GetTitle", () => {
  it("complète la fiche avec la langue originale", async () => {
    const getTitle = new GetTitle(catalog, { originalLanguage: async (t) => (t.tmdbId === "27205" ? "en" : null) });
    expect((await getTitle.execute("tm92641"))?.originalLanguage).toBe("en");
    expect(await getTitle.execute("tm0")).toBeNull();
  });
});
