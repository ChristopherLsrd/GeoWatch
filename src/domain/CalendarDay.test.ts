import { describe, expect, it } from "vitest";
import { addDays, daysBetween, parisDay } from "./CalendarDay";

describe("parisDay", () => {
  it("utilise l'heure de Paris, pas l'heure UTC", () => {
    // 23 h 30 UTC le 17 = 1 h 30 à Paris le 18 (heure d'été).
    expect(parisDay(new Date("2026-10-17T23:30:00Z"))).toBe("2026-10-18");
    expect(parisDay(new Date("2026-10-17T21:30:00Z"))).toBe("2026-10-17");
    // Heure d'hiver : 23 h 30 UTC le 15 janvier = 0 h 30 à Paris le 16.
    expect(parisDay(new Date("2027-01-15T23:30:00Z"))).toBe("2027-01-16");
  });
});

describe("daysBetween", () => {
  it("compte les jours entre deux jours calendaires", () => {
    expect(daysBetween("2026-10-17", "2026-10-18")).toBe(1);
    expect(daysBetween("2026-10-25", "2026-10-18")).toBe(-7);
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2); // passage à l'heure d'été
  });
});

describe("addDays", () => {
  it("décale un jour calendaire", () => {
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2026-10-25", 7)).toBe("2026-11-01");
  });
});
