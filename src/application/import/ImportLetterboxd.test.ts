import { describe, expect, it } from "vitest";
import { CatalogUnavailableError, type CatalogProvider } from "@/domain/ports/CatalogProvider";
import type { Title } from "@/domain/Title";
import type { WatchlistItem } from "@/domain/WatchlistItem";
import type { Watchlist } from "@/application/watchlist/Watchlist";
import { ImportLetterboxd } from "./ImportLetterboxd";
import type { LetterboxdEntry } from "./parseLetterboxdCsv";

const movie = (id: string, name: string, year: number): Title => ({
  id,
  type: "MOVIE",
  name,
  originalTitle: null,
  year,
  posterUrl: null,
  imdbId: null,
  tmdbId: null,
});
const entry = (name: string, year: number, addedAt: string | null = "2024-03-05"): LetterboxdEntry => ({
  name,
  year,
  addedAt,
  letterboxdUri: null,
});

function setup(search: (query: string) => Title[] | Error, existing: string[] = []) {
  const added: { titleId: string; addedAt?: Date }[] = [];
  const sleeps: number[] = [];
  const catalog = {
    searchTitles: async (query: string) => {
      const result = search(query);
      if (result instanceof Error) throw result;
      return result;
    },
  } as unknown as CatalogProvider;
  const watchlist = {
    get: async (id: string) => (existing.includes(id) ? ({ title: { id } } as WatchlistItem) : null),
    add: async (titleId: string, options: { addedAt?: Date } = {}) => {
      added.push({ titleId, addedAt: options.addedAt });
      return { title: movie(titleId, titleId, 2000), details: null, note: "", addedAt: options.addedAt ?? new Date() };
    },
  } as unknown as Watchlist;
  const importer = new ImportLetterboxd(catalog, watchlist, async (ms) => void sleeps.push(ms), 1000);
  return { importer, added, sleeps };
}

describe("ImportLetterboxd", () => {
  it("ajoute un film sûr avec sa date Letterboxd, en pause entre deux films", async () => {
    const { importer, added, sleeps } = setup((q) => (q === "Heat" ? [movie("tm1", "Heat", 1995)] : []));
    const { results, remaining } = await importer.importEntries([entry("Heat", 1995), entry("Inconnu", 1990)]);
    expect(results.map((r) => r.status)).toEqual(["added", "notFound"]);
    expect(added).toEqual([{ titleId: "tm1", addedAt: new Date("2024-03-05T12:00:00Z") }]);
    expect(sleeps).toEqual([1000]);
    expect(remaining).toEqual([]);
  });

  it("ajoute un film sûr sans date d'ajout si la date Letterboxd n'existe pas réellement", async () => {
    const { importer, added } = setup((q) => (q === "Heat" ? [movie("tm1", "Heat", 1995)] : []));
    const { results } = await importer.importEntries([entry("Heat", 1995, "2024-02-30")]);
    expect(results[0]).toMatchObject({ status: "added", title: { id: "tm1" } });
    expect(added).toEqual([{ titleId: "tm1", addedAt: undefined }]);
  });

  it("ne touche pas à un film déjà dans la liste", async () => {
    const { importer, added } = setup(() => [movie("tm1", "Heat", 1995)], ["tm1"]);
    const { results } = await importer.importEntries([entry("Heat", 1995)]);
    expect(results[0]).toMatchObject({ status: "alreadyInList", title: { id: "tm1" } });
    expect(added).toEqual([]);
  });

  it("renvoie les candidats d'un film douteux sans l'ajouter", async () => {
    const candidates = [movie("tm1", "Dune", 2021), movie("tm2", "Dune", 2021)];
    const { importer, added } = setup(() => candidates);
    const { results } = await importer.importEntries([entry("Dune", 2021)]);
    expect(results[0]).toEqual({ entry: entry("Dune", 2021), status: "ambiguous", candidates });
    expect(added).toEqual([]);
  });

  it("s'arrête si le catalogue est indisponible et renvoie les films restants", async () => {
    const { importer } = setup((q) => (q === "B" ? new CatalogUnavailableError("429") : [movie("tm1", "A", 2000)]));
    const entries = [entry("A", 2000), entry("B", 2000), entry("C", 2000)];
    const { results, remaining } = await importer.importEntries(entries);
    expect(results.map((r) => r.status)).toEqual(["added"]);
    expect(remaining).toEqual(entries.slice(1));
  });

  it("ajoute le candidat choisi avec la date Letterboxd, ou maintenant sans date", async () => {
    const { importer, added } = setup(() => []);
    await importer.resolve("tm9", "2023-12-31");
    await importer.resolve("tm8", null);
    expect(added).toEqual([
      { titleId: "tm9", addedAt: new Date("2023-12-31T12:00:00Z") },
      { titleId: "tm8", addedAt: undefined },
    ]);
  });
});
