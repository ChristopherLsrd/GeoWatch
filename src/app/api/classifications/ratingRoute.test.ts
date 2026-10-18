import { describe, expect, it } from "vitest";
import { AdvisoryUnavailableError } from "@/domain/ports/ContentAdvisoryProvider";
import { CatalogUnavailableError } from "@/domain/ports/CatalogProvider";
import type { ListRatedTitles } from "@/application/ratings/ListRatedTitles";
import { handleRatingRequest } from "./handleRatingRequest";

function useCase(impl: ListRatedTitles["execute"]) {
  const calls: Parameters<ListRatedTitles["execute"]>[] = [];
  const execute: ListRatedTitles["execute"] = async (...args) => {
    calls.push(args);
    return impl(...args);
  };
  return { useCase: { execute } as ListRatedTitles, calls };
}

const empty = async () => ({ titles: [], total: 0, nextCursor: null, homeAvailable: false });

describe("handleRatingRequest", () => {
  it("transmet la requête analysée", async () => {
    const { useCase: uc, calls } = useCase(empty);
    const response = await handleRatingRequest(uc, "FR", "-16", new URLSearchParams("sort=year&violence=severe&after=NDA%3D"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ titles: [], total: 0, nextCursor: null, homeAvailable: false });
    expect(calls[0][0]).toMatchObject({ country: "FR", code: "-16", sort: "year", after: "NDA=", type: null });
    expect(calls[0][1]).toEqual({ violence: "severe" });
  });

  it("répond 404 pour un pays ou une classification inconnus", async () => {
    const { useCase: uc, calls } = useCase(empty);
    expect((await handleRatingRequest(uc, "FR", "PG", new URLSearchParams())).status).toBe(404);
    expect((await handleRatingRequest(uc, "XX", "12", new URLSearchParams())).status).toBe(404);
    expect(calls).toHaveLength(0);
  });

  it("répond 503 si JustWatch ou IMDb sont indisponibles", async () => {
    const jw = useCase(async () => {
      throw new CatalogUnavailableError("JustWatch a répondu 429");
    });
    expect((await handleRatingRequest(jw.useCase, "FR", "12", new URLSearchParams())).status).toBe(503);

    const imdb = useCase(async () => {
      throw new AdvisoryUnavailableError("IMDb a répondu 403");
    });
    const response = await handleRatingRequest(imdb.useCase, "FR", "12", new URLSearchParams("violence=severe"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "advisory_unavailable", message: "Guide parental indisponible" });
  });
});
