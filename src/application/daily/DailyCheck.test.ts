import { describe, expect, it, vi } from "vitest";
import type { Availability } from "@/domain/Availability";
import type { Offer } from "@/domain/Offer";
import type { AlertRepository } from "@/domain/ports/AlertRepository";
import type { PriceHistory } from "@/domain/PriceHistory";
import type { PriceHistoryRepository } from "@/domain/ports/PriceHistoryRepository";
import type { AvailabilityCache } from "@/domain/ports/AvailabilityCache";
import { CatalogUnavailableError, type CatalogProvider } from "@/domain/ports/CatalogProvider";
import type { WatchStatusRepository } from "@/domain/ports/WatchStatusRepository";
import type { Subscription } from "@/domain/Subscription";
import type { Title } from "@/domain/Title";
import type { Alert, WatchStatus } from "@/domain/WatchStatus";
import type { WatchlistItem } from "@/domain/WatchlistItem";
import { GetTitleAvailability } from "../catalog/GetTitleAvailability";
import type { AlertNotifier } from "../push/NotifyAlerts";
import { DailyCheck } from "./DailyCheck";

const netflix = { id: "8", name: "Netflix", iconUrl: null };
const canal = { id: "381", name: "Canal+", iconUrl: null };
const apple = { id: "2", name: "Apple TV Store", iconUrl: null };

function title(id: string): Title {
  return { id, type: "MOVIE", name: `Film ${id}`, year: 2020, posterUrl: null, imdbId: null, tmdbId: null };
}

function offer(country: string, platform: typeof netflix, audioLanguages: string[] = []): Offer {
  return {
    country,
    platform,
    monetizationType: "FLATRATE",
    quality: "HD",
    price: null,
    priceValue: null,
    currency: null,
    audioLanguages,
    subtitleLanguages: [],
    url: "https://example.com",
  } as Offer;
}

function rent(value: number): Offer {
  return { ...offer("FR", apple), monetizationType: "RENT", price: `${value} €`, priceValue: value, currency: "EUR" };
}

function setup(items: WatchlistItem[], subscriptions: Subscription[]) {
  let catalogOffers: Record<string, Offer[]> = {};
  let unavailable = false;
  const requests: string[][] = [];
  const catalog: CatalogProvider = {
    searchTitles: async () => [],
    getTitleDetails: async () => null,
    getTitle: async () => null,
    listSubscriptionPlatforms: async () => [],
    getOffers: async (titleId, countries) => {
      if (unavailable) throw new CatalogUnavailableError("429");
      requests.push(countries);
      const result: Record<string, Offer[]> = {};
      for (const country of countries) result[country] = (catalogOffers[titleId] ?? []).filter((o) => o.country === country);
      return result;
    },
  };
  // Pas de cache : chaque passage interroge le « catalogue ».
  const cache: AvailabilityCache = { find: async () => [], save: async (_: Availability[]) => {} };
  const statuses = new Map<string, WatchStatus>();
  const statusRepo: WatchStatusRepository = {
    get: async (id) => statuses.get(id) ?? null,
    getMany: async (ids) => ids.flatMap((id) => statuses.get(id) ?? []),
    list: async () => [...statuses.values()],
    save: async (status) => {
      if (status.titleId === failStatusSaveAt) throw new Error("Mongo indisponible");
      statuses.set(status.titleId, status);
    },
  };
  let failAlertsOnce = false;
  const stored: Alert[] = [];
  const alertRepo: AlertRepository = {
    list: async () => stored,
    add: async (alerts) => {
      if (failAlertsOnce) {
        failAlertsOnce = false;
        throw new Error("Mongo indisponible");
      }
      stored.push(...alerts);
    },
    remove: async () => {},
    clear: async () => {},
  };
  let now = new Date("2026-10-17T05:00:00Z");
  let failPrices = false;
  let failStatusSaveAt: string | null = null;
  const histories = new Map<string, PriceHistory>();
  const priceRepo: PriceHistoryRepository = {
    list: async () => [...histories.values()],
    listForTitles: async (ids) => [...histories.values()].filter((h) => ids.includes(h.titleId)),
    save: async (list) => {
      if (failPrices) throw new Error("Mongo indisponible");
      for (const h of list) histories.set(`${h.titleId}:${h.platformId}:${h.monetizationType}`, h);
    },
  };
  const notified: Alert[][] = [];
  let failNotify = false;
  const notifier: AlertNotifier = {
    execute: async (alerts) => {
      if (failNotify) throw new Error("FCM indisponible");
      notified.push(alerts);
      return { sent: alerts.length, failed: 0, removed: 0 };
    },
  };
  let onSleep = () => {};
  const check = new DailyCheck(
    { list: async () => items } as never,
    { list: async () => subscriptions } as never,
    new GetTitleAvailability(catalog, cache),
    statusRepo,
    alertRepo,
    priceRepo,
    { get: async () => null, save: async () => {} },
    notifier,
    () => now,
    async () => onSleep(),
  );
  return {
    check,
    stored,
    requests,
    setOffers: (offers: Record<string, Offer[]>) => (catalogOffers = offers),
    setUnavailable: () => (unavailable = true),
    histories,
    setNow: (date: Date) => (now = date),
    failPrices: () => (failPrices = true),
    failAlertsOnce: () => (failAlertsOnce = true),
    statuses,
    notified,
    failStatusSaveAt: (id: string) => (failStatusSaveAt = id),
    failNotify: () => (failNotify = true),
    setOnSleep: (fn: () => void) => (onSleep = fn),
  };
}

const item = (id: string): WatchlistItem => ({ title: title(id), details: null, note: "", addedAt: new Date() });

describe("DailyCheck", () => {
  it("sert de référence au premier passage, puis signale l'arrivée chez moi et la VF", async () => {
    const t = setup([item("tm1")], [{ platform: netflix, country: "FR" }]);
    t.setOffers({ tm1: [offer("BE", canal)] });
    expect(await t.check.execute()).toEqual({ checked: 1, total: 1, alerts: 0, stoppedEarly: null, notified: 0 });

    t.setOffers({ tm1: [offer("BE", canal), offer("FR", netflix, ["fr", "en"])] });
    const report = await t.check.execute();
    expect(report.alerts).toBe(2);
    expect(t.stored.map((a) => [a.id, a.kind, a.platform?.name ?? null, a.country])).toEqual([
      ["tm1:AT_HOME:FR:8", "AT_HOME", "Netflix", "FR"],
      ["tm1:FRENCH_AUDIO", "FRENCH_AUDIO", null, null],
    ]);

    // Rien de nouveau le lendemain.
    expect((await t.check.execute()).alerts).toBe(0);
  });

  it("interroge les pays prioritaires et ceux des abonnements en une requête", async () => {
    const t = setup([item("tm1")], [{ platform: netflix, country: "US" }]);
    await t.check.execute();
    expect(t.requests).toEqual([["FR", "BE", "CH", "LU", "MC", "CA", "GF", "PF", "US"]]);
  });

  it("s'arrête proprement si JustWatch limite les requêtes", async () => {
    const t = setup([item("tm1"), item("tm2")], []);
    t.setUnavailable();
    expect(await t.check.execute()).toEqual({ checked: 0, total: 2, alerts: 0, stoppedEarly: "catalog_unavailable", notified: 0 });
  });

  it("suit les prix en France et signale une baisse le lendemain", async () => {
    const t = setup([item("tm1")], []);
    t.setOffers({ tm1: [rent(4.99)] });
    expect((await t.check.execute()).alerts).toBe(0);

    t.setNow(new Date("2026-10-18T05:00:00Z"));
    t.setOffers({ tm1: [rent(3.99)] });
    const report = await t.check.execute();
    expect(report.alerts).toBe(1);
    expect(t.stored.map((a) => a.id)).toEqual(["tm1:PRICE_DROP:FR:2:RENT:3.99"]);
    expect([...t.histories.values()][0].points.map((p) => [p.day, p.value])).toEqual([
      ["2026-10-17", 4.99],
      ["2026-10-18", 3.99],
    ]);
  });

  it("une erreur d'écriture des prix n'arrête pas la vérification", async () => {
    const t = setup([item("tm1"), item("tm2")], []);
    t.setOffers({ tm1: [rent(4.99)], tm2: [rent(2.99)] });
    t.failPrices();
    expect(await t.check.execute()).toEqual({ checked: 2, total: 2, alerts: 0, stoppedEarly: null, notified: 0 });
    expect(t.statuses.size).toBe(2);
  });

  it("n'enregistre pas l'historique si l'ajout de l'alerte échoue, la baisse est re-détectée", async () => {
    const t = setup([item("tm1")], []);
    t.setOffers({ tm1: [rent(4.99)] });
    await t.check.execute();

    t.setNow(new Date("2026-10-18T05:00:00Z"));
    t.setOffers({ tm1: [rent(3.99)] });
    t.failAlertsOnce();
    expect((await t.check.execute()).alerts).toBe(0);
    expect([...t.histories.values()][0].points.map((p) => p.value)).toEqual([4.99]);

    expect((await t.check.execute()).alerts).toBe(1);
    expect(t.stored.map((a) => a.id)).toEqual(["tm1:PRICE_DROP:FR:2:RENT:3.99"]);
  });

  it("notifie une seule fois à la fin, avec toutes les alertes du passage", async () => {
    const t = setup([item("tm1"), item("tm2")], [{ platform: netflix, country: "FR" }]);
    await t.check.execute();
    expect(t.notified).toEqual([]);

    t.setOffers({ tm1: [offer("FR", netflix)], tm2: [offer("FR", netflix)] });
    const report = await t.check.execute();
    expect(t.notified.map((alerts) => alerts.map((a) => a.id))).toEqual([["tm1:AT_HOME:FR:8", "tm2:AT_HOME:FR:8"]]);
    expect(report.notified).toBe(2);
  });

  it("notifie les alertes trouvées avant un arrêt anticipé", async () => {
    const t = setup([item("tm1"), item("tm2")], [{ platform: netflix, country: "FR" }]);
    await t.check.execute();
    t.setOffers({ tm1: [offer("FR", netflix)], tm2: [offer("FR", netflix)] });
    t.setOnSleep(() => t.setUnavailable());
    const report = await t.check.execute();
    expect(report.stoppedEarly).toBe("catalog_unavailable");
    expect(t.notified.map((alerts) => alerts.map((a) => a.id))).toEqual([["tm1:AT_HOME:FR:8"]]);
  });

  it("une erreur de notification ne fait pas échouer le passage", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const t = setup([item("tm1")], [{ platform: netflix, country: "FR" }]);
    await t.check.execute();
    t.setOffers({ tm1: [offer("FR", netflix)] });
    t.failNotify();
    expect(await t.check.execute()).toEqual({ checked: 1, total: 1, alerts: 1, stoppedEarly: null, notified: 0 });
  });

  it("ne notifie pas les alertes trouvées à l'ajout d'un titre", async () => {
    const t = setup([], [{ platform: netflix, country: "FR" }]);
    await t.check.checkTitle(title("tm1"));
    t.setOffers({ tm1: [offer("FR", netflix)] });
    await t.check.checkTitle(title("tm1"));
    expect(t.stored.map((a) => a.id)).toEqual(["tm1:AT_HOME:FR:8"]);
    expect(t.notified).toEqual([]);
  });

  it("notifie les alertes déjà trouvées avant de remonter une erreur inattendue", async () => {
    const t = setup([item("tm1"), item("tm2")], [{ platform: netflix, country: "FR" }]);
    await t.check.execute();
    t.setOffers({ tm1: [offer("FR", netflix)], tm2: [offer("FR", netflix)] });
    t.failStatusSaveAt("tm2");
    await expect(t.check.execute()).rejects.toThrow("Mongo indisponible");
    expect(t.notified.map((alerts) => alerts.map((a) => a.id))).toEqual([["tm1:AT_HOME:FR:8"]]);
  });

  it("compte et notifie une baisse de prix même si l'historique ne s'enregistre pas", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const t = setup([item("tm1")], []);
    t.setOffers({ tm1: [rent(4.99)] });
    await t.check.execute();

    t.setNow(new Date("2026-10-18T05:00:00Z"));
    t.setOffers({ tm1: [rent(3.99)] });
    t.failPrices();
    const report = await t.check.execute();
    expect(report.alerts).toBe(1);
    expect(t.notified.map((alerts) => alerts.map((a) => a.id))).toEqual([["tm1:PRICE_DROP:FR:2:RENT:3.99"]]);
  });
});
