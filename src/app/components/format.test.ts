import { describe, expect, it } from "vitest";
import { formatLifeDates, formatPrice } from "./format";

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
  it("accepte une date ISO complète", () => {
    expect(formatLifeDates("1970-07-30T00:00:00Z", null, today)).toBe("Naissance : 30 juillet 1970 (56 ans)");
    expect(formatLifeDates("1930-05-31T00:00:00Z", "2020-08-02T00:00:00Z", today)).toBe("31 mai 1930 – 2 août 2020 (90 ans)");
  });
  it("ignore une date invalide sans lever d'erreur", () => {
    expect(formatLifeDates("pas une date", null, today)).toBe("");
    expect(formatLifeDates("1970-07-30", "invalide", today)).toBe("Naissance : 30 juillet 1970 (56 ans)");
  });
  it("affiche la seule date de décès", () => {
    expect(formatLifeDates(null, "2020-08-02", today)).toBe("Décès : 2 août 2020");
  });
  it("chaîne vide sans date de naissance", () => {
    expect(formatLifeDates(null, null, today)).toBe("");
  });
});

describe("formatPrice", () => {
  it("formate un prix en français", () => {
    expect(formatPrice(4.99, "EUR").replace(/\s/g, " ")).toBe("4,99 €");
    expect(formatPrice(13, "EUR").replace(/\s/g, " ")).toBe("13,00 €");
  });
  it("repli si la devise n'est pas un code ISO 4217", () => {
    expect(formatPrice(4.99, "EURO")).toBe("4,99 EURO");
  });
});
