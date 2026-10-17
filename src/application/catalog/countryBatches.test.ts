import { describe, expect, it } from "vitest";
import { JUSTWATCH_COUNTRIES, PRIORITY_1, PRIORITY_2 } from "@/config/countries";
import { countryBatches } from "./countryBatches";

describe("countryBatches", () => {
  const batches = countryBatches();

  it("commence par la priorité 1, puis la priorité 2", () => {
    expect(batches[0]).toEqual(PRIORITY_1);
    expect(batches[1]).toEqual(PRIORITY_2);
  });

  it("couvre tous les pays JustWatch une seule fois, par lots de 20 au plus", () => {
    const all = batches.flat();
    expect(new Set(all).size).toBe(all.length);
    expect(new Set(all)).toEqual(new Set([...JUSTWATCH_COUNTRIES, ...PRIORITY_1, ...PRIORITY_2]));
    expect(batches.every((batch) => batch.length > 0 && batch.length <= 20)).toBe(true);
  });
});
