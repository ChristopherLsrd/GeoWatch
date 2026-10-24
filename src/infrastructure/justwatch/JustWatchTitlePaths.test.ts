import { describe, expect, it } from "vitest";
import { JustWatchTitlePaths } from "./JustWatchTitlePaths";

function fakeFetch(status: number, body: unknown) {
  const calls: { query: string; variables: Record<string, unknown> }[] = [];
  const fn = (async (_url: string, init: RequestInit) => {
    calls.push(JSON.parse(String(init.body)));
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

describe("JustWatchTitlePaths", () => {
  it("retrouve un film par le chemin de sa page", async () => {
    const { fn, calls } = fakeFetch(200, { data: { urlV2: { node: { id: "tm119206", __typename: "Movie" } } } });
    expect(await new JustWatchTitlePaths(fn).byPath("/fr/film/les-evades")).toBe("tm119206");
    expect(calls[0].query).toContain("urlV2(fullPath: $fullPath)");
    expect(calls[0].variables).toEqual({ fullPath: "/fr/film/les-evades" });
  });

  it("retrouve une série", async () => {
    const { fn } = fakeFetch(200, { data: { urlV2: { node: { id: "ts4", __typename: "Show" } } } });
    expect(await new JustWatchTitlePaths(fn).byPath("/fr/serie/breaking-bad")).toBe("ts4");
  });

  it("ignore une page qui n'est ni un film ni une série", async () => {
    const { fn } = fakeFetch(200, { data: { urlV2: { node: { id: "tss1", __typename: "Season" } } } });
    expect(await new JustWatchTitlePaths(fn).byPath("/fr/serie/breaking-bad/saison-1")).toBeNull();
  });

  it("renvoie null pour un chemin inconnu", async () => {
    const { fn } = fakeFetch(200, { data: { urlV2: null }, errors: [{ message: "not found" }] });
    expect(await new JustWatchTitlePaths(fn).byPath("/fr/film/inconnu")).toBeNull();
  });
});
