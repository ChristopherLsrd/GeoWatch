import { describe, expect, it } from "vitest";
import { CatalogUnavailableError } from "@/domain/ports/CatalogProvider";
import type { WatchStatusRepository } from "@/domain/ports/WatchStatusRepository";
import type { Subscription } from "@/domain/Subscription";
import type { Title } from "@/domain/Title";
import type { WatchStatus } from "@/domain/WatchStatus";
import type { WatchlistDetails, WatchlistItem } from "@/domain/WatchlistItem";
import type { Watchlist } from "./Watchlist";
import { WatchlistCheck } from "./WatchlistCheck";

const netflix = { id: "8", name: "Netflix", iconUrl: null };
const subscriptions: Subscription[] = [{ platform: netflix, country: "FR" }];
const details = { directors: ["X"] } as unknown as WatchlistDetails;

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

type Outcome = "ok" | "unavailable";

function setup(items: WatchlistItem[], initial: WatchStatus[], outcome: (id: string) => Outcome = () => "ok") {
  const statuses = new Map(initial.map((s) => [s.titleId, s]));
  const log: string[] = [];
  let subscriptionReads = 0;
  const repository: WatchStatusRepository = {
    get: async (id) => statuses.get(id) ?? null,
    getMany: async (ids) => ids.flatMap((id) => statuses.get(id) ?? []),
    list: async () => [...statuses.values()],
    save: async (s) => void statuses.set(s.titleId, s),
  };
  const watchlist = {
    list: async () => items,
    completeDetails: async (i: WatchlistItem) => {
      log.push(`details:${i.title.id}`);
      if (outcome(i.title.id) === "unavailable") throw new CatalogUnavailableError("429");
      i.details = details;
      return true;
    },
  } as unknown as Watchlist;
  const check = new WatchlistCheck(
    watchlist,
    repository,
    {
      list: async () => {
        subscriptionReads++;
        return subscriptions;
      },
      add: async () => {},
      remove: async () => {},
    },
    async (title: Title, subs: Subscription[]) => {
      log.push(`check:${title.id}`);
      expect(subs).toBe(subscriptions);
      if (outcome(title.id) === "unavailable") throw new CatalogUnavailableError("429");
      statuses.set(title.id, status(title.id, ["FR:8"]));
    },
  );
  return { check, log, subscriptionReads: () => subscriptionReads };
}

describe("WatchlistCheck", () => {
  it("traite 3 titres au plus, du plus récent au plus ancien, fiche d'abord", async () => {
    // L'ordre reçu de watchlist.list() est déjà du plus récent au plus ancien.
    const { check, log, subscriptionReads } = setup(
      [item("tm1", false), item("tm2"), item("tm3"), item("tm4"), item("tm5")],
      [status("tm3", ["FR:8"])],
    );
    const result = await check.run();
    expect(log).toEqual(["details:tm1", "check:tm1", "check:tm2", "check:tm4"]);
    expect(result.items.map((i) => [i.title.id, i.availableAtHome?.map((s) => s.platform.name)])).toEqual([
      ["tm1", ["Netflix"]],
      ["tm2", ["Netflix"]],
      ["tm4", ["Netflix"]],
    ]);
    expect(result).toMatchObject({ pending: 1, checked: 3, completed: 1 });
    expect(subscriptionReads()).toBe(1);
  });

  it("ne vérifie pas un titre qui a déjà son badge, et complète seulement sa fiche", async () => {
    const { check, log } = setup([item("tm1", false)], [status("tm1", [])]);
    const result = await check.run();
    expect(log).toEqual(["details:tm1"]);
    expect(result).toMatchObject({ pending: 0, checked: 0, completed: 1 });
  });

  it("renvoie le travail fait quand JustWatch devient indisponible en cours de route", async () => {
    const { check, log } = setup([item("tm1"), item("tm2"), item("tm3")], [], (id) => (id === "tm2" ? "unavailable" : "ok"));
    const result = await check.run();
    expect(log).toEqual(["check:tm1", "check:tm2"]);
    expect(result.items.map((i) => i.title.id)).toEqual(["tm1"]);
    expect(result).toMatchObject({ pending: 2, checked: 1, completed: 0 });
  });

  it("lève CatalogUnavailableError si JustWatch est indisponible avant le premier titre", async () => {
    const { check } = setup([item("tm1")], [], () => "unavailable");
    await expect(check.run()).rejects.toBeInstanceOf(CatalogUnavailableError);
  });

  it("ne fait rien quand tout est à jour", async () => {
    const { check, log } = setup([item("tm1")], [status("tm1", ["FR:8"])]);
    expect(await check.run()).toEqual({ items: [], pending: 0, checked: 0, completed: 0 });
    expect(log).toEqual([]);
  });
});
