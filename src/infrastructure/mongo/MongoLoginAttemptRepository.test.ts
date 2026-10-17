import { MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoLoginAttemptRepository } from "./MongoLoginAttemptRepository";

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

describe("MongoLoginAttemptRepository", () => {
  it("enregistre, relit, remplace et supprime une tentative", async () => {
    const db = client.db("test");
    const repository = new MongoLoginAttemptRepository(db);
    const windowStart = new Date("2026-10-17T10:00:00Z");

    expect(await repository.find("1.2.3.4")).toBeNull();

    await repository.save({ key: "1.2.3.4", failures: 1, windowStart, blockedUntil: null });
    await repository.save({ key: "1.2.3.4", failures: 2, windowStart, blockedUntil: null });
    expect(await repository.find("1.2.3.4")).toEqual({ key: "1.2.3.4", failures: 2, windowStart, blockedUntil: null });

    const indexes = await db.collection("loginAttempts").indexes();
    expect(indexes.some((index) => index.expireAfterSeconds === 0 && index.key.expiresAt === 1)).toBe(true);

    await repository.delete("1.2.3.4");
    expect(await repository.find("1.2.3.4")).toBeNull();
  });
});
