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

function repository(histories: PriceHistory[], asked: string[][] = []) {
  return {
    list: async () => [],
    listForTitles: async (ids: string[]) => {
      asked.push(ids);
      return histories;
    },
    save: async () => {},
  };
}

describe("TitlePrices", () => {
  it("renvoie les historiques du titre avec le plus bas et le plus haut", async () => {
    const asked: string[][] = [];
    const prices = new TitlePrices(repository([history, { ...history, platformId: "3", points: [] }], asked));
    expect(await prices.forTitle("tm1")).toEqual([{ ...history, low: 3.99, high: 4.99 }]);
    expect(asked).toEqual([["tm1"]]);
  });

  it("ne garde que les points de la devise actuelle", async () => {
    const mixed: PriceHistory = {
      ...history,
      points: [
        { day: "2026-06-07", value: 10, currency: "USD", quality: "HD" },
        { day: "2026-06-08", value: 4.99, currency: "EUR", quality: "HD" },
        { day: "2026-06-09", value: 3.99, currency: "EUR", quality: "HD" },
      ],
    };
    const [view] = await new TitlePrices(repository([mixed])).forTitle("tm1");
    expect(view).toEqual({ ...history, points: mixed.points.slice(1), low: 3.99, high: 4.99 });
  });

  it("trie location avant achat, puis par plateforme", async () => {
    const at = (platformName: string, monetizationType: PriceHistory["monetizationType"]): PriceHistory => ({
      ...history,
      platformName,
      monetizationType,
    });
    const prices = new TitlePrices(
      repository([
        at("Prime Video", "RENT"),
        at("Apple TV Store", "BUY"),
        at("Apple TV Store", "RENT"),
      ]),
    );
    const names = (await prices.forTitle("tm1")).map((view) => `${view.platformName} ${view.monetizationType}`);
    expect(names).toEqual(["Apple TV Store RENT", "Prime Video RENT", "Apple TV Store BUY"]);
  });
});
