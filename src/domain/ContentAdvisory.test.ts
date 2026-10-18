import { describe, expect, it } from "vitest";
import { isSeverity, matchesAdvisory } from "./ContentAdvisory";

describe("matchesAdvisory", () => {
  const advisory = { violence: "severe", profanity: "mild" } as const;

  it("exige exactement l'intensité demandée", () => {
    expect(matchesAdvisory(advisory, { violence: "severe" })).toBe(true);
    expect(matchesAdvisory(advisory, { violence: "moderate" })).toBe(false);
  });

  it("exige toutes les catégories demandées", () => {
    expect(matchesAdvisory(advisory, { violence: "severe", profanity: "mild" })).toBe(true);
    expect(matchesAdvisory(advisory, { violence: "severe", profanity: "none" })).toBe(false);
    expect(matchesAdvisory(advisory, { nudity: "none" })).toBe(false);
  });

  it("accepte tout avec un filtre vide, même sans guide parental", () => {
    expect(matchesAdvisory(advisory, {})).toBe(true);
    expect(matchesAdvisory(null, {})).toBe(true);
  });

  it("refuse un titre sans guide parental dès qu'un filtre est demandé", () => {
    expect(matchesAdvisory(null, { violence: "none" })).toBe(false);
    expect(matchesAdvisory(undefined, { violence: "none" })).toBe(false);
  });
});

describe("isSeverity", () => {
  it("reconnaît les quatre intensités", () => {
    expect(["none", "mild", "moderate", "severe"].every(isSeverity)).toBe(true);
    expect(isSeverity("strong")).toBe(false);
    expect(isSeverity(undefined)).toBe(false);
  });
});
