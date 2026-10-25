import { describe, expect, it } from "vitest";
import type { PriceHistory } from "@/domain/PriceHistory";
import { latestPriceDrop } from "./priceDrop";

const NOW = new Date("2026-10-25T05:00:00Z");
const threshold = { amount: 0.5, percent: 10 };

function history(platformName: string, points: [string, number][]): PriceHistory {
  return {
    titleId: "tm1",
    country: "FR",
    platformId: platformName,
    platformName,
    monetizationType: "RENT",
    points: points.map(([day, value]) => ({ day, value, currency: "EUR", quality: "HD" })),
  };
}

describe("latestPriceDrop", () => {
  it("donne la plus forte baisse des 7 derniers jours", () => {
    expect(
      latestPriceDrop(
        [history("Apple TV Store", [["2026-10-01", 4.99], ["2026-10-20", 3.99]]), history("Rakuten TV", [["2026-10-01", 4.99], ["2026-10-18", 2.99]])],
        threshold,
        NOW,
      ),
    ).toEqual({ value: 2.99, previous: 4.99, currency: "EUR", percent: 40, platformName: "Rakuten TV", monetizationType: "RENT", day: "2026-10-18" });
  });

  it("rien pour une baisse de plus de 7 jours, sous le seuil, ou suivie d'une hausse", () => {
    expect(latestPriceDrop([history("A", [["2026-10-01", 4.99], ["2026-10-17", 3.99]])], threshold, NOW)).toBeNull();
    expect(latestPriceDrop([history("A", [["2026-10-01", 4.99], ["2026-10-24", 4.79]])], threshold, NOW)).toBeNull();
    expect(latestPriceDrop([history("A", [["2026-10-01", 4.99], ["2026-10-20", 3.99], ["2026-10-24", 4.99]])], threshold, NOW)).toBeNull();
    expect(latestPriceDrop([history("A", [["2026-10-01", 4.99]])], threshold, NOW)).toBeNull();
  });
});
