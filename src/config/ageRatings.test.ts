import { describe, expect, it } from "vitest";
import { isKnownAgeRating } from "./ageRatings";

describe("isKnownAgeRating", () => {
  it("reconnaît les classifications françaises et américaines", () => {
    expect(isKnownAgeRating("FR", "12")).toBe(true);
    expect(isKnownAgeRating("FR", "-16")).toBe(true);
    expect(isKnownAgeRating("US", "PG-13")).toBe(true);
    expect(isKnownAgeRating("FR", "PG-13")).toBe(false);
    expect(isKnownAgeRating("FR", "NR")).toBe(false);
    expect(isKnownAgeRating("DE", "12")).toBe(false);
  });
});
