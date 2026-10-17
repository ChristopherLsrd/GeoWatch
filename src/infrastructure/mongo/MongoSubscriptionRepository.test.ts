import { MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoSubscriptionRepository } from "./MongoSubscriptionRepository";

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

const netflix = { id: "8", name: "Netflix", iconUrl: null };
const canal = { id: "381", name: "Canal+", iconUrl: null };

describe("MongoSubscriptionRepository", () => {
  it("ajoute sans doublon, garde l'ordre d'ajout et retire", async () => {
    const repository = new MongoSubscriptionRepository(async () => client.db("test"));

    await repository.add({ platform: netflix, country: "FR" });
    await repository.add({ platform: canal, country: "FR" });
    await repository.add({ platform: netflix, country: "BE" });
    await repository.add({ platform: netflix, country: "FR" });

    expect(await repository.list()).toEqual([
      { platform: netflix, country: "FR" },
      { platform: canal, country: "FR" },
      { platform: netflix, country: "BE" },
    ]);

    await repository.remove("8", "FR");
    expect((await repository.list()).map((s) => `${s.country}:${s.platform.id}`)).toEqual(["FR:381", "BE:8"]);
  });
});
