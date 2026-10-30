import { MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoPushSubscriptionRepository } from "./MongoPushSubscriptionRepository";

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

const subscription = (endpoint: string, device: string, day: number) => ({
  endpoint,
  keys: { p256dh: "p", auth: "a" },
  device,
  createdAt: new Date(Date.UTC(2026, 9, day)),
});

describe("MongoPushSubscriptionRepository", () => {
  it("enregistre, remplace par endpoint, liste par date et retire", async () => {
    const repository = new MongoPushSubscriptionRepository(async () => client.db("test"));
    await repository.save(subscription("https://push/b", "Edge · Windows", 2));
    await repository.save(subscription("https://push/a", "Chrome · Android", 1));
    await repository.save(subscription("https://push/b", "Edge · Windows 11", 2));

    expect(await repository.list()).toEqual([
      subscription("https://push/a", "Chrome · Android", 1),
      subscription("https://push/b", "Edge · Windows 11", 2),
    ]);

    await repository.remove("https://push/a");
    expect((await repository.list()).map((s) => s.endpoint)).toEqual(["https://push/b"]);
  });
});
