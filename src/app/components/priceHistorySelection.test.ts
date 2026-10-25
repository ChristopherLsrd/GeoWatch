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
    points: [],
    low: 1,
    high: 2,
  }) as PriceHistoryView;

const offer = (platformId: string, monetizationType: Offer["monetizationType"]): Offer =>
  ({ monetizationType, platform: { id: platformId, name: platformId } }) as Offer;

describe("selectPriceHistories", () => {
  const histories = [history("p1", "RENT"), history("p1", "BUY"), history("p2", "RENT"), history("p1", "RENT", "BE")];

  it("garde les historiques dont la ligne a une offre du même type sur la même plateforme", () => {
    const result = selectPriceHistories(histories, "FR", ["p1", "p2"], [offer("p1", "RENT"), offer("p2", "FLATRATE")]);
    expect(result.map((h) => `${h.platformId}:${h.monetizationType}`)).toEqual(["p1:RENT"]);
  });

  it("écarte l'historique d'une offre qui n'existe plus", () => {
    expect(selectPriceHistories(histories, "FR", ["p1"], [offer("p1", "FLATRATE")])).toEqual([]);
  });

  it("écarte les autres pays et les plateformes hors du groupe", () => {
    const offers = [offer("p1", "RENT"), offer("p2", "RENT")];
    expect(selectPriceHistories(histories, "BE", ["p1"], offers)).toHaveLength(1);
    expect(selectPriceHistories(histories, "FR", ["p2"], offers).map((h) => h.platformId)).toEqual(["p2"]);
  });
});
