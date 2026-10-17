import { MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Title } from "@/domain/Title";
import { MongoWatchlistRepository } from "./MongoWatchlistRepository";

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

function title(id: string, name: string): Title {
  return { id, type: "MOVIE", name, year: 2010, posterUrl: null, imdbId: `tt${id}`, tmdbId: id };
}

describe("MongoWatchlistRepository", () => {
  it("ajoute sans dupliquer, trie par date d'ajout, modifie la note et retire", async () => {
    const repository = new MongoWatchlistRepository(async () => client.db("test"));

    await repository.add({ title: title("1", "Ancien"), note: "", addedAt: new Date("2026-10-01") });
    await repository.add({ title: title("2", "Récent"), note: "", addedAt: new Date("2026-10-17") });
    await repository.add({ title: title("1", "Ancien bis"), note: "écrasée ?", addedAt: new Date("2026-10-20") });

    expect((await repository.list()).map((i) => i.title.name)).toEqual(["Récent", "Ancien"]);

    expect(await repository.updateNote("1", "en VO")).toBe(true);
    expect(await repository.updateNote("3", "absent")).toBe(false);
    expect(await repository.get("1")).toEqual({ title: title("1", "Ancien"), note: "en VO", addedAt: new Date("2026-10-01") });

    await repository.remove("1");
    expect(await repository.get("1")).toBeNull();
    expect(await repository.list()).toHaveLength(1);
  });
});
