import { describe, expect, it } from "vitest";
import type { Title } from "@/domain/Title";
import { classify, normalizeTitle } from "./matchLetterboxd";

const movie = (id: string, name: string, year: number | null, originalTitle: string | null = null): Title => ({
  id,
  type: "MOVIE",
  name,
  originalTitle,
  year,
  posterUrl: null,
  imdbId: null,
  tmdbId: null,
});

describe("normalizeTitle", () => {
  it("ignore casse, accents, ponctuation et article initial", () => {
    expect(normalizeTitle("The Dark Knight")).toBe("dark knight");
    expect(normalizeTitle("Amélie")).toBe("amelie");
    expect(normalizeTitle("L'Été meurtrier")).toBe("ete meurtrier");
    expect(normalizeTitle("Les Évadés")).toBe("evades");
    expect(normalizeTitle("Mission: Impossible – Fallout")).toBe("mission impossible fallout");
  });

  it("garde les lettres non latines", () => {
    expect(normalizeTitle("千と千尋の神隠し")).toBe("千と千尋の神隠し");
  });
});

describe("classify", () => {
  it("est sûr quand un seul film a le même titre et une année à ±1 an", () => {
    const results = [movie("tm1", "Heat", 1995), movie("tm2", "Heat", 1986)];
    expect(classify({ name: "Heat", year: 1996 }, results)).toEqual({ kind: "sure", title: results[0] });
  });

  it("compare aussi au titre original", () => {
    const shawshank = movie("tm3", "Les Évadés", 1994, "The Shawshank Redemption");
    expect(classify({ name: "The Shawshank Redemption", year: 1994 }, [shawshank])).toEqual({
      kind: "sure",
      title: shawshank,
    });
  });

  it("ignore les séries", () => {
    const show: Title = { ...movie("ts1", "Heat", 1995), type: "SHOW" };
    expect(classify({ name: "Heat", year: 1995 }, [show])).toEqual({ kind: "notFound" });
  });

  it("est à valider quand plusieurs films ont le même titre et une année compatible", () => {
    const results = [movie("tm1", "Dune", 2021), movie("tm2", "Dune", 2021)];
    expect(classify({ name: "Dune", year: 2021 }, results)).toEqual({ kind: "ambiguous", candidates: results });
  });

  it("est à valider quand aucun titre ne correspond mais qu'une année est compatible, avec 5 candidats au plus", () => {
    const results = Array.from({ length: 7 }, (_, i) => movie(`tm${i}`, `Autre ${i}`, 2001));
    expect(classify({ name: "Spirited Away", year: 2001 }, results)).toEqual({
      kind: "ambiguous",
      candidates: results.slice(0, 5),
    });
  });

  it("est introuvable sans film d'année compatible", () => {
    expect(classify({ name: "Heat", year: 1995 }, [movie("tm1", "Heat", 2010), movie("tm2", "Heat", null)])).toEqual({
      kind: "notFound",
    });
  });

  it("accepte toutes les années quand l'année Letterboxd est absente", () => {
    const results = [movie("tm1", "Heat", 1995)];
    expect(classify({ name: "Heat", year: null }, results)).toEqual({ kind: "sure", title: results[0] });
  });

  it("cherche une série quand le type est précisé, un film sinon", () => {
    const show = { ...movie("ts4", "Breaking Bad", 2008), type: "SHOW" as const };
    expect(classify({ name: "Breaking Bad", year: 2008, type: "SHOW" }, [show])).toEqual({ kind: "sure", title: show });
    expect(classify({ name: "Breaking Bad", year: 2008 }, [show])).toEqual({ kind: "notFound" });
  });
});
