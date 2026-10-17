import { MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Offer } from "@/domain/Offer";
import { MongoAvailabilityCache } from "./MongoAvailabilityCache";

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

const offer: Offer = {
  country: "FR",
  platform: { id: "8", name: "Netflix", iconUrl: null },
  monetizationType: "FLATRATE",
  quality: "HD",
  price: null,
  priceValue: null,
  currency: "EUR",
  audioLanguages: ["fr"],
  subtitleLanguages: [],
  url: null,
};

describe("MongoAvailabilityCache", () => {
  it("relit les disponibilités du jour de Paris et remplace les anciennes", async () => {
    const db = client.db("test");
    const cache = new MongoAvailabilityCache(async () => db);
    const yesterday = new Date("2026-10-16T10:00:00Z");
    const today = new Date("2026-10-17T10:00:00Z");

    await cache.save([
      { titleId: "tm1", country: "FR", offers: [offer], fetchedAt: yesterday },
      { titleId: "tm1", country: "US", offers: [], fetchedAt: today },
    ]);
    expect((await cache.find("tm1", ["FR", "US", "BE"], "2026-10-17")).map((a) => a.country)).toEqual(["US"]);

    await cache.save([{ titleId: "tm1", country: "FR", offers: [offer], fetchedAt: today }]);
    const found = await cache.find("tm1", ["FR", "US"], "2026-10-17");
    expect(found).toHaveLength(2);
    expect(found.find((a) => a.country === "FR")).toEqual({ titleId: "tm1", country: "FR", offers: [offer], fetchedAt: today });
    expect(await db.collection("availabilities").countDocuments()).toBe(2);
    expect(await cache.find("tm2", ["FR"], "2026-10-17")).toEqual([]);

    const indexes = await db.collection("availabilities").indexes();
    expect(indexes.some((index) => index.key.fetchedAt === 1 && index.expireAfterSeconds === 7 * 24 * 3600)).toBe(true);
  });
});
