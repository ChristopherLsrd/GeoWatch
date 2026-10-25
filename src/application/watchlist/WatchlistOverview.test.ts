import { describe, expect, it } from "vitest";
import type { WatchStatusRepository } from "@/domain/ports/WatchStatusRepository";
import type { Subscription } from "@/domain/Subscription";
import type { WatchStatus } from "@/domain/WatchStatus";
import type { WatchlistDetails, WatchlistItem } from "@/domain/WatchlistItem";
import type { Watchlist } from "./Watchlist";
import { toOverviewItems, WatchlistOverview } from "./WatchlistOverview";

const netflix = { id: "8", name: "Netflix", iconUrl: null };
const canal = { id: "381", name: "Canal+", iconUrl: null };
const subscriptions: Subscription[] = [
  { platform: netflix, country: "FR" },
  { platform: canal, country: "FR" },
];

const details = { directors: [] } as unknown as WatchlistDetails;

function item(id: string, withDetails = true): WatchlistItem {
  return {
    title: { id, type: "MOVIE", name: id, year: null, posterUrl: null, imdbId: null, tmdbId: null },
    details: withDetails ? details : null,
    note: "",
    addedAt: new Date("2026-10-17"),
  };
}

const status = (titleId: string, flatrate?: string[]): WatchStatus => ({
  titleId,
  atHome: [],
  flatrate,
  frenchAudio: false,
  checkedAt: new Date(),
});

function setup(items: WatchlistItem[], statuses: WatchStatus[]) {
  const calls: string[] = [];
  const repository: WatchStatusRepository = {
    get: async () => null,
    getMany: async () => {
      calls.push("getMany");
      return [];
    },
    list: async () => {
      calls.push("list");
      return statuses;
    },
    save: async () => {},
  };
  const overview = new WatchlistOverview(
    { list: async () => items } as unknown as Watchlist,
    repository,
    { list: async () => subscriptions, add: async () => {}, remove: async () => {} },
  );
  return { overview, calls };
}

const badges = (items: Awaited<ReturnType<WatchlistOverview["list"]>>["items"]) =>
  items.map((i) => [i.title.id, i.availableAtHome?.map((s) => s.platform.name) ?? null]);

describe("WatchlistOverview", () => {
  it("calcule le badge avec les abonnements actuels, en lisant tous les états d'un coup", async () => {
    const { overview, calls } = setup(
      [item("tm1"), item("tm2"), item("tm3")],
      [status("tm1", ["FR:8", "BE:381"]), status("tm2", []), status("tm3", ["FR:381"])],
    );
    const { items, pending } = await overview.list();
    expect(badges(items)).toEqual([
      ["tm1", ["Netflix"]],
      ["tm2", []],
      ["tm3", ["Canal+"]],
    ]);
    expect(pending).toBe(0);
    expect(calls).toEqual(["list"]);
  });

  it("ne vérifie rien et compte les titres sans badge ou sans fiche", async () => {
    // tm1 : état ancien sans flatrate ; tm2 : jamais vérifié ; tm3 : vérifié mais sans fiche ; tm4 : complet.
    const { overview } = setup(
      [item("tm1"), item("tm2"), item("tm3", false), item("tm4")],
      [status("tm1"), status("tm3", []), status("tm4", ["FR:8"])],
    );
    const { items, pending } = await overview.list();
    expect(badges(items)).toEqual([
      ["tm1", null],
      ["tm2", null],
      ["tm3", []],
      ["tm4", ["Netflix"]],
    ]);
    expect(pending).toBe(3);
  });

  it("ajoute la pastille de baisse, sauf aux titres disponibles chez moi", () => {
    const priceDrop = { value: 3.99, previous: 4.99, currency: "EUR", percent: 20, platformName: "Apple TV Store", monetizationType: "RENT" as const, day: "2026-10-24" };
    const drops = new Map([["tm1", priceDrop], ["tm2", priceDrop]]);
    const statuses = new Map([["tm1", status("tm1", [])], ["tm2", status("tm2", ["FR:8"])]]);
    const items = toOverviewItems([item("tm1"), item("tm2"), item("tm3")], statuses, subscriptions, drops);
    expect(items.map((i) => [i.title.id, i.priceDrop?.percent ?? null])).toEqual([["tm1", 20], ["tm2", null], ["tm3", null]]);
  });
});
