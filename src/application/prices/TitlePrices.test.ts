import { describe, expect, it } from "vitest";
import type { PriceHistory } from "@/domain/PriceHistory";
import { TitlePrices } from "./TitlePrices";

const history: PriceHistory = {
  titleId: "tm1",
  country: "FR",
  platformId: "2",
  platformName: "Apple TV Store",
  monetizationType: "RENT",
  points: [
    { day: "2026-06-08", value: 4.99, currency: "EUR", quality: "HD" },
    { day: "2026-06-09", value: 3.99, currency: "EUR", quality: "HD" },
  ],
};

describe("TitlePrices", () => {
  it("renvoie les historiques du titre avec le plus bas et le plus haut", async () => {
    const asked: string[][] = [];
    const prices = new TitlePrices({
      list: async () => [],
      listForTitles: async (ids) => (asked.push(ids), [history, { ...history, platformId: "3", points: [] }]),
      save: async () => {},
    });
    expect(await prices.forTitle("tm1")).toEqual([{ ...history, low: 3.99, high: 4.99 }]);
    expect(asked).toEqual([["tm1"]]);
  });
});
