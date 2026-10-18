import { MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CachedPerson } from "@/domain/ports/PersonCache";
import { MongoPersonCache } from "./MongoPersonCache";

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

function entry(fetchedAt: Date, biography: string): CachedPerson {
  return {
    person: { id: "tp1725", name: "Christopher Nolan", birthDate: "1970-07-30", deathDate: null, photoUrl: null, photoCredit: null, biography, biographySource: "wikipedia", sourceUrl: "https://fr.wikipedia.org/wiki/Christopher_Nolan" },
    filmography: { DIRECTOR: [], ACTOR: [], OTHER: [] },
    flatrateCountries: ["FR"],
    fetchedAt,
  };
}

describe("MongoPersonCache", () => {
  it("relit la fiche du jour de Paris et remplace l'ancienne", async () => {
    const cache = new MongoPersonCache(async () => client.db("test"));
    await cache.save(entry(new Date("2026-10-16T10:00:00Z"), "hier"));
    expect(await cache.find("tp1725", "2026-10-17")).toBeNull();

    await cache.save(entry(new Date("2026-10-17T10:00:00Z"), "aujourd'hui"));
    const found = await cache.find("tp1725", "2026-10-17");
    expect(found?.person.biography).toBe("aujourd'hui");
    expect(found?.flatrateCountries).toEqual(["FR"]);
    expect(found?.fetchedAt).toEqual(new Date("2026-10-17T10:00:00Z"));
    expect(await cache.find("tp1", "2026-10-17")).toBeNull();
  });
});
