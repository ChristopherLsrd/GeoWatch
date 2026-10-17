import { describe, expect, it } from "vitest";
import type { CatalogProvider } from "@/domain/ports/CatalogProvider";
import type { WatchlistRepository } from "@/domain/ports/WatchlistRepository";
import type { Title } from "@/domain/Title";
import type { TitleDetails } from "@/domain/TitleDetails";
import type { WatchlistDetails, WatchlistItem } from "@/domain/WatchlistItem";
import { InvalidNoteError, NotInWatchlistError, TitleNotFoundError, Watchlist } from "./Watchlist";

class InMemoryWatchlist implements WatchlistRepository {
  items: WatchlistItem[] = [];
  async list() {
    return [...this.items].sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime());
  }
  async get(titleId: string) {
    return this.items.find((i) => i.title.id === titleId) ?? null;
  }
  async add(item: WatchlistItem) {
    if (!(await this.get(item.title.id))) this.items.push(item);
  }
  async updateNote(titleId: string, note: string) {
    const item = await this.get(titleId);
    if (item) item.note = note;
    return !!item;
  }
  async updateDetails(titleId: string, details: WatchlistDetails) {
    const item = await this.get(titleId);
    if (item) item.details = details;
  }
  async remove(titleId: string) {
    this.items = this.items.filter((i) => i.title.id !== titleId);
  }
}

const inception: Title = {
  id: "tm92641",
  type: "MOVIE",
  name: "Inception",
  year: 2010,
  posterUrl: null,
  imdbId: "tt1375666",
  tmdbId: "27205",
};

const inceptionDetails: TitleDetails = {
  ...inception,
  originalTitle: "Inception",
  synopsis: "Dom Cobb est un voleur.",
  runtime: 148,
  releaseDate: "2010-07-14",
  genres: ["Science-Fiction"],
  imdbScore: 8.8,
  imdbVotes: 2880387,
  tmdbScore: 8.4,
  directors: ["Christopher Nolan"],
  cast: [{ name: "Leonardo DiCaprio", character: "Dom Cobb" }],
};

function setup() {
  const repository = new InMemoryWatchlist();
  const catalogCalls: string[] = [];
  const catalog: CatalogProvider = {
    searchTitles: async () => [],
    getTitleDetails: async (id) => {
      catalogCalls.push(id);
      return id === inception.id ? inceptionDetails : null;
    },
    getTitle: async () => null,
    getOffers: async () => ({}),
    listSubscriptionPlatforms: async () => [],
  };
  const now = new Date("2026-10-17T10:00:00Z");
  return { repository, catalogCalls, watchlist: new Watchlist(repository, catalog, () => now), now };
}

describe("Watchlist", () => {
  it("ajoute un titre relu dans le catalogue, avec ses identifiants IMDb et TMDB et le résumé de sa fiche", async () => {
    const { watchlist, now } = setup();
    expect(await watchlist.add("tm92641")).toEqual({
      title: inception,
      details: {
        directors: ["Christopher Nolan"],
        releaseDate: "2010-07-14",
        runtime: 148,
        genres: ["Science-Fiction"],
        imdbScore: 8.8,
        tmdbScore: 8.4,
        fetchedAt: now,
      },
      note: "",
      addedAt: now,
    });
    expect((await watchlist.list()).map((i) => i.title.imdbId)).toEqual(["tt1375666"]);
  });

  it("ne duplique pas un titre déjà présent et garde sa note", async () => {
    const { watchlist, catalogCalls } = setup();
    await watchlist.add("tm92641");
    await watchlist.updateNote("tm92641", "conseillé par Léa");
    const again = await watchlist.add("tm92641");
    expect(again.note).toBe("conseillé par Léa");
    expect(catalogCalls).toHaveLength(1);
    expect(await watchlist.list()).toHaveLength(1);
  });

  it("complète à la lecture le résumé des titres ajoutés avant son introduction", async () => {
    const { watchlist, repository, catalogCalls } = setup();
    repository.items.push({ title: inception, details: null, note: "", addedAt: new Date("2026-10-01") });
    const [item] = await watchlist.list();
    expect(item.details?.directors).toEqual(["Christopher Nolan"]);
    expect(repository.items[0].details?.imdbScore).toBe(8.8);
    await watchlist.list();
    expect(catalogCalls).toHaveLength(1);
  });

  it("refuse un titre inconnu du catalogue", async () => {
    const { watchlist } = setup();
    await expect(watchlist.add("tm0")).rejects.toBeInstanceOf(TitleNotFoundError);
  });

  it("modifie la note, sans espaces superflus, dans la limite de 2000 caractères", async () => {
    const { watchlist } = setup();
    await watchlist.add("tm92641");
    await watchlist.updateNote("tm92641", "  en VO  ");
    expect((await watchlist.get("tm92641"))?.note).toBe("en VO");
    await expect(watchlist.updateNote("tm92641", "x".repeat(2001))).rejects.toBeInstanceOf(InvalidNoteError);
    await expect(watchlist.updateNote("tm1", "note")).rejects.toBeInstanceOf(NotInWatchlistError);
  });

  it("retire un titre", async () => {
    const { watchlist } = setup();
    await watchlist.add("tm92641");
    await watchlist.remove("tm92641");
    expect(await watchlist.list()).toEqual([]);
    expect(await watchlist.get("tm92641")).toBeNull();
  });
});
