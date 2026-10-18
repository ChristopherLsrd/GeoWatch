import { describe, expect, it } from "vitest";
import { isCinemaSummary, WikipediaPersonSource } from "./WikipediaPersonSource";

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const nolan = {
  type: "standard",
  description: "réalisateur, scénariste et producteur britannico-américain",
  extract: " Christopher Nolan, né le 30 juillet 1970… ",
  thumbnail: { source: "https://upload.wikimedia.org/nolan.jpg" },
  content_urls: { desktop: { page: "https://fr.wikipedia.org/wiki/Christopher_Nolan" } },
};

describe("isCinemaSummary", () => {
  it("accepte une description de cinéma, accents et casse ignorés", () => {
    expect(isCinemaSummary(nolan)).toBe(true);
    expect(isCinemaSummary({ type: "standard", description: "Actrice française" })).toBe(true);
    expect(isCinemaSummary({ type: "standard", description: "comédienne belge" })).toBe(true);
  });

  it("écarte les pages d'homonymie et les descriptions hors cinéma", () => {
    expect(isCinemaSummary({ ...nolan, type: "disambiguation" })).toBe(false);
    expect(isCinemaSummary({ type: "standard", description: "footballeur anglais" })).toBe(false);
    expect(isCinemaSummary({ type: "standard" })).toBe(false);
  });
});

describe("WikipediaPersonSource", () => {
  it("lit le résumé de la page française du nom", async () => {
    const { fn, calls } = fakeFetch(200, nolan);
    const info = await new WikipediaPersonSource({ fetch: fn }).find({ name: "Christopher Nolan", titles: [] });
    expect(calls[0].url).toBe("https://fr.wikipedia.org/api/rest_v1/page/summary/Christopher_Nolan");
    expect(new Headers(calls[0].init.headers).get("User-Agent")).toContain("GeoWatch");
    expect(info).toEqual({
      biography: "Christopher Nolan, né le 30 juillet 1970…",
      photoUrl: "https://upload.wikimedia.org/nolan.jpg",
      deathDate: null,
      sourceUrl: "https://fr.wikipedia.org/wiki/Christopher_Nolan",
    });
  });

  it("renvoie null pour une page absente, hors cinéma, ou en cas d'erreur", async () => {
    expect(await new WikipediaPersonSource({ fetch: fakeFetch(404, {}).fn }).find({ name: "X", titles: [] })).toBeNull();
    expect(await new WikipediaPersonSource({ fetch: fakeFetch(200, { ...nolan, description: "homme politique" }).fn }).find({ name: "X", titles: [] })).toBeNull();
    const failing = (async () => { throw new Error("réseau"); }) as unknown as typeof fetch;
    expect(await new WikipediaPersonSource({ fetch: failing }).find({ name: "X", titles: [] })).toBeNull();
  });
});
