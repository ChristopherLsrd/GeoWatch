import { describe, expect, it } from "vitest";
import type { WatchStatusRepository } from "@/domain/ports/WatchStatusRepository";
import type { Subscription } from "@/domain/Subscription";
import type { WatchStatus } from "@/domain/WatchStatus";
import type { WatchlistItem } from "@/domain/WatchlistItem";
import type { Watchlist } from "./Watchlist";
import { WatchlistOverview } from "./WatchlistOverview";

const netflix = { id: "8", name: "Netflix", iconUrl: null };
const canal = { id: "381", name: "Canal+", iconUrl: null };
const subscriptions: Subscription[] = [
  { platform: netflix, country: "FR" },
  { platform: canal, country: "FR" },
];

function item(id: string): WatchlistItem {
  return {
    title: { id, type: "MOVIE", name: id, year: null, posterUrl: null, imdbId: null, tmdbId: null },
    details: null,
    note: "",
    addedAt: new Date("2026-10-17"),
  };
}

function setup(initial: WatchStatus[], check: (id: string) => WatchStatus | Error) {
  const statuses = new Map(initial.map((s) => [s.titleId, s]));
  const checked: string[] = [];
  const repository: WatchStatusRepository = {
    get: async (id) => statuses.get(id) ?? null,
    getMany: async (ids) => ids.flatMap((id) => statuses.get(id) ?? []),
    save: async (s) => void statuses.set(s.titleId, s),
  };
  const overview = new WatchlistOverview(
    { list: async () => [item("tm1"), item("tm2"), item("tm3")] } as unknown as Watchlist,
    repository,
    { list: async () => subscriptions, add: async () => {}, remove: async () => {} },
    async (title) => {
      checked.push(title.id);
      const result = check(title.id);
      if (result instanceof Error) throw result;
      statuses.set(title.id, result);
    },
  );
  return { overview, checked };
}

const status = (titleId: string, flatrate?: string[]): WatchStatus => ({
  titleId,
  atHome: [],
  flatrate,
  frenchAudio: false,
  checkedAt: new Date(),
});

const badges = (items: Awaited<ReturnType<WatchlistOverview["list"]>>) =>
  items.map((i) => [i.title.id, i.availableAtHome?.map((s) => s.platform.name) ?? null]);

describe("WatchlistOverview", () => {
  it("calcule le badge avec les abonnements actuels", async () => {
    const { overview, checked } = setup(
      [status("tm1", ["FR:8", "BE:381"]), status("tm2", []), status("tm3", ["FR:381"])],
      () => new Error("inutile"),
    );
    expect(badges(await overview.list())).toEqual([
      ["tm1", ["Netflix"]],
      ["tm2", []],
      ["tm3", ["Canal+"]],
    ]);
    expect(checked).toEqual([]);
  });

  it("vérifie à la volée les titres jamais vérifiés ou vérifiés sans les offres en abonnement", async () => {
    // tm1 : état ancien, sans flatrate ; tm2 : jamais vérifié.
    const { overview, checked } = setup([status("tm1"), status("tm3", [])], (id) => status(id, ["FR:8"]));
    expect(badges(await overview.list())).toEqual([
      ["tm1", ["Netflix"]],
      ["tm2", ["Netflix"]],
      ["tm3", []],
    ]);
    expect(checked).toEqual(["tm1", "tm2"]);
  });

  it("laisse le badge inconnu si la vérification échoue", async () => {
    const { overview, checked } = setup([], () => new Error("429"));
    expect(badges(await overview.list())).toEqual([
      ["tm1", null],
      ["tm2", null],
      ["tm3", null],
    ]);
    expect(checked).toEqual(["tm1"]);
  });
});
