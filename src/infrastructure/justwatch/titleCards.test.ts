import { describe, expect, it } from "vitest";
import { offersBatchSize, toCardEntry } from "./titleCards";

describe("toCardEntry", () => {
  it("convertit un film et ignore ce qui n'est ni un film ni une série", () => {
    const content = {
      title: "Inception",
      originalTitle: "Inception",
      originalReleaseYear: 2010,
      runtime: 148,
      posterUrl: "/poster/1/s332/x.jpg",
      externalIds: { imdbId: "tt1375666", tmdbId: "27205" },
      scoring: { imdbScore: 8.8, tmdbScore: 8.4 },
    };
    expect(toCardEntry({ id: "tm1", objectType: "MOVIE", content })).toEqual({
      id: "tm1",
      type: "MOVIE",
      name: "Inception",
      originalTitle: "Inception",
      year: 2010,
      posterUrl: "https://images.justwatch.com/poster/1/s332/x.jpg",
      imdbId: "tt1375666",
      tmdbId: "27205",
      runtime: 148,
      imdbScore: 8.8,
      tmdbScore: 8.4,
      flatrate: {},
    });
    expect(toCardEntry({ id: "ts1", objectType: "SHOW_SEASON", content })).toBeNull();
    expect(toCardEntry({ id: "tm2", objectType: "MOVIE", content: null })).toBeNull();
  });
});

describe("offersBatchSize", () => {
  it("découpe les offres en lots sous la limite de complexité de JustWatch (350 000)", () => {
    // Mesuré le 2026-10-18 : environ 20 par titre, plus 150 par pays et par titre.
    expect(offersBatchSize(8) * (20 + 150 * 8)).toBeLessThanOrEqual(300_000);
    expect(offersBatchSize(8)).toBeGreaterThanOrEqual(200);
    expect(offersBatchSize(1)).toBeGreaterThanOrEqual(1000);
  });
});
