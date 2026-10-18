import { describe, expect, it } from "vitest";
import { LetterboxdCsvError, parseLetterboxdCsv } from "./parseLetterboxdCsv";

describe("parseLetterboxdCsv", () => {
  it("lit les lignes d'une watchlist Letterboxd", () => {
    const csv = "Date,Name,Year,Letterboxd URI\n2024-03-05,Inception,2010,https://boxd.it/1skk\n";
    expect(parseLetterboxdCsv(csv)).toEqual({
      entries: [{ name: "Inception", year: 2010, addedAt: "2024-03-05", letterboxdUri: "https://boxd.it/1skk" }],
      skipped: 0,
    });
  });

  it("gère guillemets, virgules et guillemets doublés, BOM et fins de ligne CRLF", () => {
    const csv =
      '﻿Date,Name,Year,Letterboxd URI\r\n' +
      '2024-01-02,"Crouching Tiger, Hidden Dragon",2000,https://boxd.it/a\r\n' +
      '2024-01-03,"The ""Burbs""",1989,https://boxd.it/b\r\n';
    expect(parseLetterboxdCsv(csv).entries.map((e) => e.name)).toEqual(["Crouching Tiger, Hidden Dragon", 'The "Burbs"']);
  });

  it("repère les colonnes par leur nom, quel que soit leur ordre", () => {
    const csv = "Name,Letterboxd URI,Year,Date\nHeat,https://boxd.it/c,1995,2023-12-31\n";
    expect(parseLetterboxdCsv(csv).entries).toEqual([
      { name: "Heat", year: 1995, addedAt: "2023-12-31", letterboxdUri: "https://boxd.it/c" },
    ]);
  });

  it("accepte une année ou une date absente ou invalide, et un lien non https", () => {
    const csv = "Date,Name,Year,Letterboxd URI\n,Sans année,,javascript:alert(1)\nhier,Autre,19xx,\n";
    expect(parseLetterboxdCsv(csv).entries).toEqual([
      { name: "Sans année", year: null, addedAt: null, letterboxdUri: null },
      { name: "Autre", year: null, addedAt: null, letterboxdUri: null },
    ]);
  });

  it("ignore et compte les lignes sans titre ou au titre trop long, sans compter les lignes vides", () => {
    const csv = `Date,Name,Year,Letterboxd URI\n2024-01-01,,2010,\n\n2024-01-01,${"x".repeat(301)},2010,\n2024-01-01,Ok,2010,\n`;
    const result = parseLetterboxdCsv(csv);
    expect(result.entries.map((e) => e.name)).toEqual(["Ok"]);
    expect(result.skipped).toBe(2);
  });

  it("refuse un fichier vide ou sans colonne Name", () => {
    expect(() => parseLetterboxdCsv("")).toThrow(LetterboxdCsvError);
    expect(() => parseLetterboxdCsv("Date,Title,Year\n2024-01-01,Heat,1995\n")).toThrow(LetterboxdCsvError);
  });
});
