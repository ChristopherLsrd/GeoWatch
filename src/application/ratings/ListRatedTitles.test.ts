import { describe, expect, it } from "vitest";
import type { ContentAdvisory } from "@/domain/ContentAdvisory";
import type { ContentAdvisoryProvider } from "@/domain/ports/ContentAdvisoryProvider";
import type { RatedTitle, RatingCatalog, RatingQuery } from "@/domain/ports/RatingCatalog";
import type { SubscriptionRepository } from "@/domain/ports/SubscriptionRepository";
import type { Subscription } from "@/domain/Subscription";
import { ListRatedTitles, MAX_RATING_PAGES } from "./ListRatedTitles";

const query: RatingQuery = {
  country: "FR",
  code: "12",
  type: null,
  search: null,
  genre: null,
  yearFrom: null,
  yearTo: null,
  imdbMin: null,
  homeOnly: false,
  sort: "popular",
  after: null,
};

function title(n: number): RatedTitle {
  return { id: `tm${n}`, type: "MOVIE", name: `Film ${n}`, year: 2000, posterUrl: null, imdbId: `tt${n}`, tmdbId: null, runtime: null, imdbScore: null, tmdbScore: null };
}

// pages[i] : titres de la page i ; le curseur de la page i est « c{i+1} », nul après la dernière.
function fakeCatalog(pages: RatedTitle[][], flatrateFails = false) {
  const lists: { after: string | null; homePlatformIds: string[] }[] = [];
  const flatrateCalls: string[][] = [];
  const catalog: RatingCatalog = {
    list: async (q, homePlatformIds) => {
      lists.push({ after: q.after, homePlatformIds });
      const index = q.after ? Number(q.after.slice(1)) : 0;
      return { titles: pages[index], total: 8330, nextCursor: index + 1 < pages.length ? `c${index + 1}` : null };
    },
    flatrate: async (ids) => {
      flatrateCalls.push(ids);
      if (flatrateFails) throw new Error("JustWatch a répondu 429");
      return new Map(ids.map((id) => [id, { FR: id === "tm1" ? ["8"] : [] }]));
    },
    genres: async () => [],
  };
  return { catalog, lists, flatrateCalls };
}

const netflix: Subscription = { platform: { id: "8", name: "Netflix", iconUrl: null }, country: "FR" };
const subscriptions = (subs: Subscription[]) => ({ list: async () => subs }) as unknown as SubscriptionRepository;

function guides(byId: Record<string, ContentAdvisory>) {
  const calls: string[][] = [];
  const provider: ContentAdvisoryProvider = {
    advisories: async (ids) => {
      calls.push(ids);
      return new Map(ids.filter((id) => byId[id]).map((id) => [id, byId[id]]));
    },
  };
  return { provider, calls };
}

describe("ListRatedTitles", () => {
  it("renvoie la page du catalogue avec le badge « Chez moi », sans guide parental", async () => {
    const { catalog, lists } = fakeCatalog([[title(1), title(2)], [title(3)]]);
    const { provider, calls } = guides({});
    const result = await new ListRatedTitles(catalog, provider, subscriptions([netflix])).execute(query, {});

    expect(lists).toEqual([{ after: null, homePlatformIds: ["8"] }]);
    expect(calls).toHaveLength(0);
    expect(result.total).toBe(8330);
    expect(result.nextCursor).toBe("c1");
    expect(result.homeAvailable).toBe(true);
    expect(result.titles.map((t) => [t.id, t.availableAtHome])).toEqual([
      ["tm1", [netflix]],
      ["tm2", []],
    ]);
  });

  it("enchaîne les pages avec un filtre sur les raisons jusqu'à 40 titres", async () => {
    const pageA = Array.from({ length: 40 }, (_, i) => title(i));
    const pageB = Array.from({ length: 40 }, (_, i) => title(100 + i));
    const pageC = [title(200)];
    const { catalog, lists, flatrateCalls } = fakeCatalog([pageA, pageB, pageC]);
    // 25 titres violents dans la page A, 25 dans la page B : 50 gardés en deux pages.
    const byId = Object.fromEntries([...pageA.slice(0, 25), ...pageB.slice(0, 25)].map((t) => [t.imdbId!, { violence: "severe" as const }]));
    const { provider } = guides(byId);
    const result = await new ListRatedTitles(catalog, provider, subscriptions([netflix])).execute(query, { violence: "severe" });

    expect(lists.map((l) => l.after)).toEqual([null, "c1"]);
    expect(result.titles).toHaveLength(50);
    expect(result.nextCursor).toBe("c2");
    expect(result.total).toBeNull();
    expect(flatrateCalls).toEqual([result.titles.map((t) => t.id)]);
  });

  it(`s'arrête après ${MAX_RATING_PAGES} pages, même avec peu de titres gardés`, async () => {
    const pages = Array.from({ length: 5 }, (_, p) => Array.from({ length: 40 }, (_, i) => title(p * 100 + i)));
    const { catalog, lists } = fakeCatalog(pages);
    const { provider } = guides({ tt0: { nudity: "none" } });
    const result = await new ListRatedTitles(catalog, provider, subscriptions([])).execute(query, { nudity: "none" });

    expect(lists).toHaveLength(3);
    expect(result.titles.map((t) => t.id)).toEqual(["tm0"]);
    expect(result.nextCursor).toBe("c3");
    expect(result.homeAvailable).toBe(false);
  });

  it("s'arrête à la dernière page du catalogue", async () => {
    const { catalog, lists } = fakeCatalog([[title(1)], [title(2)]]);
    const { provider } = guides({});
    const result = await new ListRatedTitles(catalog, provider, subscriptions([])).execute(query, { violence: "mild" });
    expect(lists).toHaveLength(2);
    expect(result).toMatchObject({ titles: [], nextCursor: null, total: null });
  });

  it("affiche les titres sans badge si les offres sont indisponibles", async () => {
    const { catalog } = fakeCatalog([[title(1)]], true);
    const { provider } = guides({});
    const result = await new ListRatedTitles(catalog, provider, subscriptions([netflix])).execute(query, {});
    expect(result.titles.map((t) => t.availableAtHome)).toEqual([[]]);
  });

  it("ne transmet que les abonnements du pays de la liste", async () => {
    const { catalog, lists } = fakeCatalog([[title(1)]]);
    const { provider } = guides({});
    const belgian: Subscription = { platform: { id: "337", name: "Disney Plus", iconUrl: null }, country: "BE" };
    await new ListRatedTitles(catalog, provider, subscriptions([netflix, belgian])).execute({ ...query, country: "US", code: "R" }, {});
    expect(lists[0].homePlatformIds).toEqual([]);
  });
});
