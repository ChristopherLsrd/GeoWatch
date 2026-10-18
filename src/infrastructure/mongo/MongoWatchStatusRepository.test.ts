import { MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoWatchStatusRepository } from "./MongoWatchStatusRepository";

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

describe("MongoWatchStatusRepository", () => {
  it("liste tous les états enregistrés", async () => {
    const repository = new MongoWatchStatusRepository(async () => client.db("list-test"));
    const checkedAt = new Date("2026-10-18T05:00:00Z");
    await repository.save({ titleId: "tm1", atHome: ["FR:8"], flatrate: ["FR:8"], frenchAudio: true, checkedAt });
    await repository.save({ titleId: "tm2", atHome: [], flatrate: [], frenchAudio: false, checkedAt });
    const all = await repository.list();
    expect(all.map((s) => s.titleId).sort()).toEqual(["tm1", "tm2"]);
    expect(all.find((s) => s.titleId === "tm1")).toEqual({ titleId: "tm1", atHome: ["FR:8"], flatrate: ["FR:8"], frenchAudio: true, checkedAt });
  });
});
