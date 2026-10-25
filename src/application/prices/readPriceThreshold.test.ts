import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PRICE_THRESHOLD } from "@/domain/PriceHistory";
import { readPriceThreshold } from "./readPriceThreshold";

describe("readPriceThreshold", () => {
  it("lit le seuil des préférences, sinon le seuil par défaut, même si la lecture échoue", async () => {
    const custom = { amount: 1, percent: 5 };
    const prefs = (get: () => Promise<unknown>) => ({ get, save: async () => {} }) as never;
    expect(await readPriceThreshold(prefs(async () => ({ audioLanguage: null, subtitleLanguage: null, priceDropThreshold: custom })))).toEqual(custom);
    expect(await readPriceThreshold(prefs(async () => null))).toEqual(DEFAULT_PRICE_THRESHOLD);
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await readPriceThreshold(prefs(() => Promise.reject(new Error("Mongo"))))).toEqual(DEFAULT_PRICE_THRESHOLD);
  });
});
