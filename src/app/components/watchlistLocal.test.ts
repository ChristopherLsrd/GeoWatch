import { describe, expect, it } from "vitest";
import type { OverviewItem } from "./HomeBadge";
import {
  CHECK_CAPS,
  clearLocalWatchlist,
  mergeItems,
  nextCheckAllowed,
  readLocalWatchlist,
  WATCHLIST_STORAGE_KEY,
  writeLocalWatchlist,
} from "./watchlistLocal";

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

const throwing = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
  removeItem: () => {
    throw new Error("SecurityError");
  },
};

const item = (id: string, availableAtHome: OverviewItem["availableAtHome"] = null): OverviewItem =>
  ({
    title: { id, type: "MOVIE", name: id, year: null, posterUrl: null, imdbId: null, tmdbId: null },
    details: null,
    note: "",
    addedAt: "2026-10-17T00:00:00.000Z",
    availableAtHome,
  }) as OverviewItem;

describe("copie locale de la liste à voir", () => {
  it("relit ce qu'elle a écrit", () => {
    const storage = new MemoryStorage();
    writeLocalWatchlist(storage, [item("tm1")]);
    expect(readLocalWatchlist(storage)?.map((i) => i.title.id)).toEqual(["tm1"]);
    expect(JSON.parse(storage.data.get(WATCHLIST_STORAGE_KEY)!).v).toBe(1);
  });

  it("ignore une copie absente, illisible ou d'un autre format", () => {
    const storage = new MemoryStorage();
    expect(readLocalWatchlist(storage)).toBeNull();
    storage.setItem(WATCHLIST_STORAGE_KEY, "{pas du json");
    expect(readLocalWatchlist(storage)).toBeNull();
    storage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify({ v: 2, items: [] }));
    expect(readLocalWatchlist(storage)).toBeNull();
    storage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify({ v: 1, items: "x" }));
    expect(readLocalWatchlist(storage)).toBeNull();
  });

  it("ne lève jamais d'erreur, même sans stockage ou avec un stockage qui refuse", () => {
    expect(readLocalWatchlist(null)).toBeNull();
    expect(readLocalWatchlist(throwing)).toBeNull();
    expect(() => writeLocalWatchlist(throwing, [item("tm1")])).not.toThrow();
    expect(() => clearLocalWatchlist(throwing)).not.toThrow();
  });

  it("s'efface", () => {
    const storage = new MemoryStorage();
    writeLocalWatchlist(storage, [item("tm1")]);
    clearLocalWatchlist(storage);
    expect(readLocalWatchlist(storage)).toBeNull();
  });
});

describe("mergeItems", () => {
  it("remplace les éléments mis à jour et garde l'ordre", () => {
    const merged = mergeItems([item("tm1"), item("tm2"), item("tm3")], [item("tm2", [])]);
    expect(merged.map((i) => [i.title.id, i.availableAtHome])).toEqual([
      ["tm1", null],
      ["tm2", []],
      ["tm3", null],
    ]);
  });

  it("ignore un élément retiré entre-temps", () => {
    expect(mergeItems([item("tm1")], [item("tm9", [])]).map((i) => i.title.id)).toEqual(["tm1"]);
  });
});

describe("nextCheckAllowed", () => {
  it("continue tant qu'il reste du travail et que les plafonds ne sont pas atteints", () => {
    expect(nextCheckAllowed({ checked: 0, completed: 0 }, 5)).toBe(true);
    expect(nextCheckAllowed({ checked: 9, completed: 19 }, 5)).toBe(true);
  });

  it("s'arrête quand rien ne reste ou qu'un plafond est atteint", () => {
    expect(nextCheckAllowed({ checked: 0, completed: 0 }, 0)).toBe(false);
    expect(nextCheckAllowed({ checked: CHECK_CAPS.checked, completed: 0 }, 5)).toBe(false);
    expect(nextCheckAllowed({ checked: 0, completed: CHECK_CAPS.completed }, 5)).toBe(false);
  });
});
