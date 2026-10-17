import { describe, expect, it } from "vitest";
import { parisDay } from "./CalendarDay";

describe("parisDay", () => {
  it("utilise l'heure de Paris, pas l'heure UTC", () => {
    // 23 h 30 UTC le 17 = 1 h 30 à Paris le 18 (heure d'été).
    expect(parisDay(new Date("2026-10-17T23:30:00Z"))).toBe("2026-10-18");
    expect(parisDay(new Date("2026-10-17T21:30:00Z"))).toBe("2026-10-17");
    // Heure d'hiver : 23 h 30 UTC le 15 janvier = 0 h 30 à Paris le 16.
    expect(parisDay(new Date("2027-01-15T23:30:00Z"))).toBe("2027-01-16");
  });
});
