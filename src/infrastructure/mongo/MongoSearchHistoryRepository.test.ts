import { MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SearchHistory } from "@/application/history/SearchHistory";
import { MongoSearchHistoryRepository } from "./MongoSearchHistoryRepository";

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

// Teste le cas d'usage et l'adaptateur Mongo ensemble : la logique utile est dans l'adaptateur.
function setup(dbName: string) {
  let now = new Date("2026-10-17T10:00:00Z");
  const history = new SearchHistory(new MongoSearchHistoryRepository(async () => client.db(dbName)), () => now);
  const tick = () => (now = new Date(now.getTime() + 1000));
  return { history, tick };
}

describe("SearchHistory avec Mongo", () => {
  it("enregistre de la plus récente à la plus ancienne, sans doublon, casse ignorée", async () => {
    const { history, tick } = setup("h1");
    await history.record("Inception");
    tick();
    await history.record("  le   bureau des légendes ");
    tick();
    await history.record("INCEPTION");
    expect((await history.list()).map((e) => e.query)).toEqual(["INCEPTION", "le bureau des légendes"]);
  });

  it("ignore les recherches trop courtes", async () => {
    const { history } = setup("h2");
    await history.record(" a ");
    expect(await history.list()).toEqual([]);
  });

  it("ne garde que les 50 dernières", async () => {
    const { history, tick } = setup("h3");
    for (let i = 1; i <= 52; i++) {
      await history.record(`recherche ${i}`);
      tick();
    }
    const entries = await history.list();
    expect(entries).toHaveLength(50);
    expect(entries[0].query).toBe("recherche 52");
    expect(entries.at(-1)?.query).toBe("recherche 3");
  });

  it("vide tout l'historique", async () => {
    const { history } = setup("h4");
    await history.record("Inception");
    await history.clear();
    expect(await history.list()).toEqual([]);
  });
});
