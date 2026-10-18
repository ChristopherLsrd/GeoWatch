import { describe, expect, it } from "vitest";
import { AdvisoryUnavailableError } from "@/domain/ports/ContentAdvisoryProvider";
import { ImdbParentsGuide } from "./ImdbParentsGuide";

function fakeFetch(responses: { status: number; body: unknown }[]) {
  const calls: { url: string; headers: Record<string, string>; query: string }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, headers: init.headers as Record<string, string>, query: JSON.parse(String(init.body)).query });
    const { status, body } = responses[calls.length - 1];
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const fightClub = {
  id: "tt0137523",
  parentsGuide: {
    categories: [
      { category: { id: "NUDITY" }, severity: { id: "moderateVotes" } },
      { category: { id: "VIOLENCE" }, severity: { id: "severeVotes" } },
      { category: { id: "PROFANITY" }, severity: { id: "severeVotes" } },
      { category: { id: "ALCOHOL" }, severity: { id: "mildVotes" } },
      { category: { id: "FRIGHTENING" }, severity: { id: "noneVotes" } },
      { category: { id: "SPOILERS" }, severity: { id: "severeVotes" } },
      { category: { id: "VIOLENCE" }, severity: null },
    ],
  },
};

describe("ImdbParentsGuide", () => {
  it("convertit les catégories et les intensités, et ignore ce qu'il ne connaît pas", async () => {
    const { fn, calls } = fakeFetch([
      { status: 200, body: { data: { titles: [fightClub, { id: "tt0000001", parentsGuide: { categories: [] } }, null] } } },
    ]);
    const guides = await new ImdbParentsGuide(fn).advisories(["tt0137523", "tt0000001", "tt0137523", "pas-un-id"]);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.graphql.imdb.com/");
    expect(calls[0].headers["x-imdb-client-name"]).toBe("imdb-web-next-localized");
    expect(calls[0].query).toContain('titles(ids: ["tt0137523","tt0000001"])');
    expect(guides).toEqual(
      new Map([["tt0137523", { nudity: "moderate", violence: "severe", profanity: "severe", alcohol: "mild", frightening: "none" }]]),
    );
  });

  it("découpe en lots de 40 identifiants", async () => {
    const ids = Array.from({ length: 41 }, (_, i) => `tt${1000 + i}`);
    const { fn, calls } = fakeFetch([
      { status: 200, body: { data: { titles: [] } } },
      { status: 200, body: { data: { titles: [] } } },
    ]);
    await new ImdbParentsGuide(fn).advisories(ids);
    expect(calls).toHaveLength(2);
    expect(calls[1].query).toContain('titles(ids: ["tt1040"])');
  });

  it("ne fait aucune requête sans identifiant valable", async () => {
    const { fn, calls } = fakeFetch([]);
    expect(await new ImdbParentsGuide(fn).advisories(["", "abc"])).toEqual(new Map());
    expect(calls).toHaveLength(0);
  });

  it("signale IMDb indisponible en cas de refus, de réponse illisible ou de réseau en panne", async () => {
    await expect(new ImdbParentsGuide(fakeFetch([{ status: 403, body: "non" }]).fn).advisories(["tt1"])).rejects.toBeInstanceOf(
      AdvisoryUnavailableError,
    );
    await expect(
      new ImdbParentsGuide(fakeFetch([{ status: 200, body: { errors: [{ message: "x" }] } }]).fn).advisories(["tt1"]),
    ).rejects.toBeInstanceOf(AdvisoryUnavailableError);
    const broken = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    await expect(new ImdbParentsGuide(broken).advisories(["tt1"])).rejects.toBeInstanceOf(AdvisoryUnavailableError);
  });
});
