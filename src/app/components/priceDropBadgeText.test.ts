import { describe, expect, it } from "vitest";
import type { PriceDrop } from "@/application/prices/priceDrop";
import { priceDropText } from "./priceDropBadgeText";

const drop: PriceDrop = { value: 3.99, previous: 4.99, currency: "EUR", percent: 20, platformName: "Apple TV Store", monetizationType: "RENT", day: "2026-10-20" };
const now = new Date("2026-10-25T10:00:00Z");

describe("priceDropText", () => {
  it("affiche le pourcentage avec une espace fine insécable", () => {
    expect(priceDropText(drop, now)).toBe("−20 %");
  });
  it("affiche le montant quand le pourcentage arrondi vaut 0", () => {
    const text = priceDropText({ ...drop, previous: 100.5, value: 100, percent: 0 }, now);
    expect(text).toMatch(/^−0,50\s€$/);
  });
  it("garde une baisse de 7 jours, masque une plus ancienne", () => {
    expect(priceDropText({ ...drop, day: "2026-10-18" }, now)).not.toBeNull();
    expect(priceDropText({ ...drop, day: "2026-10-17" }, now)).toBeNull();
  });
});
