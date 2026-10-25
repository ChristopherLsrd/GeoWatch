import { describe, expect, it } from "vitest";
import type { PriceHistoryView } from "@/application/prices/TitlePrices";
import type { Offer } from "@/domain/Offer";
import { selectPriceHistories } from "./priceHistorySelection";

const history = (platformId: string, monetizationType: "RENT" | "BUY", country = "FR"): PriceHistoryView =>
  ({
    titleId: "t",
    country,
    platformId,
    platformName: platformId,
    monetizationType,
    points: [{ day: "2026-10-01", value: 3.99, currency: "EUR", quality: "HD" }],
    low: 2.99,
    high: 4.99,
  }) as PriceHistoryView;

const offer = (
  platformId: string,
  monetizationType: Offer["monetizationType"],
  priceValue: number | null = 3.99,
  quality = "HD",
  currency = "EUR",
): Offer => ({ monetizationType, quality, priceValue, currency, platform: { id: platformId, name: platformId } }) as Offer;

const keys = (selected: ReturnType<typeof selectPriceHistories>) =>
  selected.map(({ history: h }) => `${h.platformId}:${h.monetizationType}`);

describe("selectPriceHistories", () => {
  const histories = [history("p1", "RENT"), history("p1", "BUY"), history("p2", "RENT"), history("p1", "RENT", "BE")];

  it("garde les historiques dont la ligne a une offre du même type sur la même plateforme", () => {
    const result = selectPriceHistories(histories, "FR", ["p1", "p2"], [offer("p1", "RENT"), offer("p2", "FLATRATE", null)]);
    expect(keys(result)).toEqual(["p1:RENT"]);
  });

  it("écarte l'historique d'une offre qui n'existe plus", () => {
    expect(selectPriceHistories(histories, "FR", ["p1"], [offer("p1", "FLATRATE", null)])).toEqual([]);
  });

  it("masque l'historique quand il ne reste qu'une offre SD ou sans prix", () => {
    expect(selectPriceHistories(histories, "FR", ["p1"], [offer("p1", "RENT", 1.99, "SD")])).toEqual([]);
    expect(selectPriceHistories(histories, "FR", ["p1"], [offer("p1", "RENT", 0)])).toEqual([]);
    expect(selectPriceHistories(histories, "FR", ["p1"], [offer("p1", "RENT", null)])).toEqual([]);
  });

  it("écarte les autres pays et les plateformes hors du groupe", () => {
    const offers = [offer("p1", "RENT"), offer("p2", "RENT")];
    expect(selectPriceHistories(histories, "BE", ["p1"], offers)).toHaveLength(1);
    expect(keys(selectPriceHistories(histories, "FR", ["p2"], offers))).toEqual(["p2:RENT"]);
  });

  it("donne le prix vivant : le plus bas des offres HD/4K, SD ignorée", () => {
    const offers = [offer("p1", "RENT", 4.99), offer("p1", "RENT", 3.49, "4K"), offer("p1", "RENT", 0.99, "SD")];
    const [selected] = selectPriceHistories([history("p1", "RENT")], "FR", ["p1"], offers);
    expect(selected.current).toEqual({ value: 3.49, currency: "EUR" });
    expect(selected.low).toBe(2.99);
    expect(selected.high).toBe(4.99);
  });

  it("élargit le plus bas et le plus haut au prix vivant", () => {
    const [lower] = selectPriceHistories([history("p1", "RENT")], "FR", ["p1"], [offer("p1", "RENT", 1.99)]);
    expect([lower.low, lower.high]).toEqual([1.99, 4.99]);
    const [higher] = selectPriceHistories([history("p1", "RENT")], "FR", ["p1"], [offer("p1", "RENT", 6.99)]);
    expect([higher.low, higher.high]).toEqual([2.99, 6.99]);
  });

  it("n'élargit pas les bornes si la devise diffère", () => {
    const [selected] = selectPriceHistories([history("p1", "RENT")], "FR", ["p1"], [offer("p1", "RENT", 1.99, "HD", "USD")]);
    expect([selected.low, selected.high]).toEqual([2.99, 4.99]);
  });
});
