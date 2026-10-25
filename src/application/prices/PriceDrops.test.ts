import { describe, expect, it } from "vitest";
import type { PriceHistory } from "@/domain/PriceHistory";
import { PriceDrops } from "./PriceDrops";

const drop = (titleId: string): PriceHistory => ({
  titleId,
  country: "FR",
  platformId: "2",
  platformName: "Apple TV Store",
  monetizationType: "RENT",
  points: [
    { day: "2026-10-01", value: 4.99, currency: "EUR", quality: "HD" },
    { day: "2026-10-24", value: 4.59, currency: "EUR", quality: "HD" },
  ],
});

const clock = () => new Date("2026-10-25T05:00:00Z");

describe("PriceDrops", () => {
  it("calcule les pastilles avec le seuil des préférences", async () => {
    const prices = { list: async () => [drop("tm1"), drop("tm2")], listForTitles: async (ids: string[]) => [drop("tm1"), drop("tm2")].filter((h) => ids.includes(h.titleId)), save: async () => {} };
    // Baisse de 0,40 € (8 %) : sous le seuil par défaut, au-dessus d'un seuil de 5 %.
    const strict = new PriceDrops(prices, { get: async () => null, save: async () => {} }, clock);
    expect((await strict.forTitles()).size).toBe(0);
    const loose = new PriceDrops(
      prices,
      { get: async () => ({ audioLanguage: null, subtitleLanguage: null, priceDropThreshold: { amount: 1, percent: 5 } }), save: async () => {} },
      clock,
    );
    expect([...(await loose.forTitles()).keys()]).toEqual(["tm1", "tm2"]);
    expect([...(await loose.forTitles(["tm2"])).keys()]).toEqual(["tm2"]);
  });

  it("aucune pastille si la lecture échoue", async () => {
    const failing = { list: async () => Promise.reject(new Error("Mongo")), listForTitles: async () => [], save: async () => {} };
    expect((await new PriceDrops(failing, { get: async () => null, save: async () => {} }, clock).forTitles()).size).toBe(0);
  });
});
