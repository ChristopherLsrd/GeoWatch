import { MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ContentAdvisory } from "@/domain/ContentAdvisory";
import type { ContentAdvisoryProvider } from "@/domain/ports/ContentAdvisoryProvider";
import { AdvisoryUnavailableError } from "@/domain/ports/ContentAdvisoryProvider";
import { CachedContentAdvisories } from "./CachedContentAdvisories";

let server: MongoMemoryServer;
let client: MongoClient;

beforeAll(async () => {
  server = await MongoMemoryServer.create();
  client = await new MongoClient(server.getUri()).connect();
}, 120_000);

afterAll(async () => {
  await client?.close();
  await server?.stop();
});

function source(known: Record<string, ContentAdvisory>) {
  const calls: string[][] = [];
  const provider: ContentAdvisoryProvider = {
    advisories: async (ids) => {
      calls.push(ids);
      return new Map(ids.filter((id) => known[id]).map((id) => [id, known[id]]));
    },
  };
  return { provider, calls };
}

describe("CachedContentAdvisories", () => {
  it("n'interroge la source que pour les identifiants absents, et garde aussi les guides vides", async () => {
    const db = async () => client.db("cache-1");
    const { provider, calls } = source({ tt1: { violence: "severe" } });
    const now = () => new Date("2026-10-18T10:00:00Z");
    const cache = new CachedContentAdvisories(provider, db, now);

    expect(await cache.advisories(["tt1", "tt2", "tt1"])).toEqual(new Map([["tt1", { violence: "severe" }]]));
    expect(calls).toEqual([["tt1", "tt2"]]);

    expect(await cache.advisories(["tt1", "tt2", "tt3"])).toEqual(new Map([["tt1", { violence: "severe" }]]));
    expect(calls).toEqual([["tt1", "tt2"], ["tt3"]]);
  });

  it("réinterroge la source après 30 jours", async () => {
    const db = async () => client.db("cache-2");
    const { provider, calls } = source({ tt1: { violence: "mild" } });
    let current = new Date("2026-09-01T10:00:00Z");
    const cache = new CachedContentAdvisories(provider, db, () => current);
    await cache.advisories(["tt1"]);

    current = new Date("2026-09-30T10:00:00Z");
    await cache.advisories(["tt1"]);
    expect(calls).toHaveLength(1);

    current = new Date("2026-10-02T10:00:00Z");
    await cache.advisories(["tt1"]);
    expect(calls).toHaveLength(2);
  });

  it("ne fait rien sans identifiant", async () => {
    const { provider, calls } = source({});
    expect(await new CachedContentAdvisories(provider, async () => client.db("cache-3")).advisories([])).toEqual(new Map());
    expect(calls).toHaveLength(0);
  });

  it("laisse passer l'erreur de la source et ne met rien en cache", async () => {
    const db = async () => client.db("cache-4");
    const failing: ContentAdvisoryProvider = {
      advisories: async () => {
        throw new AdvisoryUnavailableError("IMDb a répondu 403");
      },
    };
    await expect(new CachedContentAdvisories(failing, db).advisories(["tt1"])).rejects.toBeInstanceOf(AdvisoryUnavailableError);
    expect(await (await db()).collection("advisories").countDocuments()).toBe(0);
  });

  it("interroge directement la source si Mongo est injoignable", async () => {
    const { provider, calls } = source({ tt1: { nudity: "none" } });
    const broken = async () => {
      throw new Error("Mongo injoignable");
    };
    expect(await new CachedContentAdvisories(provider, broken).advisories(["tt1"])).toEqual(new Map([["tt1", { nudity: "none" }]]));
    expect(calls).toEqual([["tt1"]]);
  });
});
