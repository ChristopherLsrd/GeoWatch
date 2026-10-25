import { describe, expect, it } from "vitest";
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
    save: async (status) => void statuses.set(status.titleId, status),
  };
  const stored: Alert[] = [];
  const alertRepo: AlertRepository = {
    list: async () => stored,
    add: async (alerts) => void stored.push(...alerts),
    remove: async () => {},
    clear: async () => {},
  };
  let now = new Date("2026-10-17T05:00:00Z");
  let failPrices = false;
  const histories = new Map<string, PriceHistory>();
  const priceRepo: PriceHistoryRepository = {
    list: async () => [...histories.values()],
    listForTitles: async (ids) => [...histories.values()].filter((h) => ids.includes(h.titleId)),
    save: async (list) => {
      if (failPrices) throw new Error("Mongo indisponible");
      for (const h of list) histories.set(`${h.titleId}:${h.platformId}:${h.monetizationType}`, h);
    },
  };
  const check = new DailyCheck(
    { list: async () => items } as never,
    { list: async () => subscriptions } as never,
    new GetTitleAvailability(catalog, cache),
    statusRepo,
    alertRepo,
    priceRepo,
    { get: async () => null, save: async () => {} },
    () => now,
    async () => {},
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
    statuses,
  };
}

const item = (id: string): WatchlistItem => ({ title: title(id), details: null, note: "", addedAt: new Date() });

describe("DailyCheck", () => {
  it("sert de référence au premier passage, puis signale l'arrivée chez moi et la VF", async () => {
    const t = setup([item("tm1")], [{ platform: netflix, country: "FR" }]);
    t.setOffers({ tm1: [offer("BE", canal)] });
    expect(await t.check.execute()).toEqual({ checked: 1, total: 1, alerts: 0, stoppedEarly: null });

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
    expect(await t.check.execute()).toEqual({ checked: 0, total: 2, alerts: 0, stoppedEarly: "catalog_unavailable" });
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
    expect(await t.check.execute()).toEqual({ checked: 2, total: 2, alerts: 0, stoppedEarly: null });
    expect(t.statuses.size).toBe(2);
  });
});
