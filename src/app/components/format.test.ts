import { describe, expect, it } from "vitest";
import { formatLifeDates } from "./format";

describe("formatLifeDates", () => {
  const today = new Date("2026-10-18T12:00:00Z");
  it("date de naissance et âge", () => {
    expect(formatLifeDates("1970-07-30", null, today)).toBe("Naissance : 30 juillet 1970 (56 ans)");
  });
  it("anniversaire pas encore passé dans l'année", () => {
    expect(formatLifeDates("1974-11-11", null, today)).toBe("Naissance : 11 novembre 1974 (51 ans)");
  });
  it("naissance et décès, avec l'âge au décès", () => {
    expect(formatLifeDates("1930-05-31", "2020-08-02", today)).toBe("31 mai 1930 – 2 août 2020 (90 ans)");
  });
  it("chaîne vide sans date de naissance", () => {
    expect(formatLifeDates(null, null, today)).toBe("");
  });
});
