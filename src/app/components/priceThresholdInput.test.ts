import { describe, expect, it } from "vitest";
import { parsePriceThreshold } from "./priceThresholdInput";

describe("parsePriceThreshold", () => {
  it("analyse deux nombres", () => {
    expect(parsePriceThreshold("1", "15")).toEqual({ amount: 1, percent: 15 });
  });

  it("accepte la virgule comme séparateur décimal", () => {
    expect(parsePriceThreshold("0,5", "12,5")).toEqual({ amount: 0.5, percent: 12.5 });
  });

  it("garde 0 (toute baisse) quand il est saisi", () => {
    expect(parsePriceThreshold("0", "0")).toEqual({ amount: 0, percent: 0 });
  });

  it("refuse un champ vide ou fait d'espaces", () => {
    expect(parsePriceThreshold("", "15")).toBeNull();
    expect(parsePriceThreshold("1", "  ")).toBeNull();
  });

  it("refuse un texte qui n'est pas un nombre", () => {
    expect(parsePriceThreshold("abc", "15")).toBeNull();
    expect(parsePriceThreshold("1", "Infinity")).toBeNull();
  });
});
