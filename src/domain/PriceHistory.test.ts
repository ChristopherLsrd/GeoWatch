import { describe, expect, it } from "vitest";
import {
  dropPercent,
  isSignificantDrop,
  lastChange,
  priceHistoryId,
  priceRange,
  type PriceHistory,
} from "./PriceHistory";

const threshold = { amount: 0.5, percent: 10 };

function history(points: [string, number, string?][]): PriceHistory {
  return {
    titleId: "tm1",
    country: "FR",
    platformId: "2",
    platformName: "Apple TV Store",
    monetizationType: "RENT",
    points: points.map(([day, value, currency = "EUR"]) => ({ day, value, currency, quality: "HD" })),
  };
}

describe("isSignificantDrop", () => {
  it("compte une baisse qui atteint le montant ou le pourcentage", () => {
    expect(isSignificantDrop(14.99, 14.49, threshold)).toBe(true); // 0,50 €, 3 %
    expect(isSignificantDrop(2.99, 2.69, threshold)).toBe(true); // 0,30 €, 10 %
    expect(isSignificantDrop(3.99, 3.49, threshold)).toBe(true); // arrondi flottant
  });

  it("ignore les petites baisses, les hausses et les prix inchangés", () => {
    expect(isSignificantDrop(4.99, 4.69, threshold)).toBe(false);
    expect(isSignificantDrop(3.99, 4.99, threshold)).toBe(false);
    expect(isSignificantDrop(3.99, 3.99, threshold)).toBe(false);
  });

  it("un seuil à 0 compte toute baisse", () => {
    expect(isSignificantDrop(3.99, 3.98, { amount: 0, percent: 0 })).toBe(true);
    expect(isSignificantDrop(3.99, 3.99, { amount: 0, percent: 0 })).toBe(false);
  });
});

describe("dropPercent", () => {
  it("arrondit le pourcentage de baisse", () => {
    expect(dropPercent(4.99, 3.99)).toBe(20);
  });
});

describe("priceHistoryId", () => {
  it("assemble titre, pays, plateforme et type", () => {
    expect(priceHistoryId(history([]))).toBe("tm1:FR:2:RENT");
  });
});

describe("priceRange", () => {
  it("donne le plus bas et le plus haut dans la devise actuelle", () => {
    expect(priceRange(history([["2026-01-01", 9, "CHF"], ["2026-02-01", 4.99], ["2026-03-01", 2.99], ["2026-04-01", 3.99]]))).toEqual({
      low: 2.99,
      high: 4.99,
    });
    expect(priceRange(history([]))).toBeNull();
  });
});

describe("lastChange", () => {
  it("renvoie les deux derniers points dans la même devise", () => {
    const change = lastChange(history([["2026-01-01", 4.99], ["2026-02-01", 3.99]]));
    expect(change?.previous.value).toBe(4.99);
    expect(change?.current.value).toBe(3.99);
  });

  it("rien avec un seul point ou un changement de devise", () => {
    expect(lastChange(history([["2026-01-01", 4.99]]))).toBeNull();
    expect(lastChange(history([["2026-01-01", 4.99, "CHF"], ["2026-02-01", 3.99]]))).toBeNull();
  });
});
