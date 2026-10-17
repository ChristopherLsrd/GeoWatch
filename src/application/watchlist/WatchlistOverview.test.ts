import { describe, expect, it } from "vitest";
import type { Subscription } from "@/domain/Subscription";
import type { WatchStatus } from "@/domain/WatchStatus";
import type { WatchlistItem } from "@/domain/WatchlistItem";
import type { Watchlist } from "./Watchlist";
import { WatchlistOverview } from "./WatchlistOverview";

const netflix = { id: "8", name: "Netflix", iconUrl: null };
const canal = { id: "381", name: "Canal+", iconUrl: null };

function item(id: string): WatchlistItem {
  return {
    title: { id, type: "MOVIE", name: id, year: null, posterUrl: null, imdbId: null, tmdbId: null },
    details: null,
    note: "",
    addedAt: new Date("2026-10-17"),
  };
}

describe("WatchlistOverview", () => {
  it("calcule le badge avec les abonnements actuels, null si le titre n'a pas été vérifié", async () => {
    const subscriptions: Subscription[] = [
      { platform: netflix, country: "FR" },
      { platform: canal, country: "FR" },
    ];
    const statuses: WatchStatus[] = [
      { titleId: "tm1", atHome: [], flatrate: ["FR:8", "BE:381"], frenchAudio: true, checkedAt: new Date() },
    ];
    const overview = new WatchlistOverview(
      { list: async () => [item("tm1"), item("tm2")] } as unknown as Watchlist,
      { get: async () => null, getMany: async () => statuses, save: async () => {} },
      { list: async () => subscriptions, add: async () => {}, remove: async () => {} },
    );
    const items = await overview.list();
    expect(items.map((i) => [i.title.id, i.availableAtHome?.map((s) => s.platform.name) ?? null])).toEqual([
      ["tm1", ["Netflix"]],
      ["tm2", null],
    ]);
  });
});
