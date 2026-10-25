import { MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PriceHistory } from "@/domain/PriceHistory";
import { MongoPriceHistoryRepository } from "./MongoPriceHistoryRepository";

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

function history(titleId: string, monetizationType: "RENT" | "BUY", value: number): PriceHistory {
  return {
    titleId,
    country: "FR",
    platformId: "2",
    platformName: "Apple TV Store",
    monetizationType,
    points: [{ day: "2026-10-25", value, currency: "EUR", quality: "HD" }],
  };
}

describe("MongoPriceHistoryRepository", () => {
  it("enregistre, remplace et relit les historiques par titre", async () => {
    const repository = new MongoPriceHistoryRepository(async () => client.db("prices-test"));
    await repository.save([history("tm1", "RENT", 4.99), history("tm1", "BUY", 13.99), history("tm2", "RENT", 2.99)]);
    await repository.save([history("tm1", "RENT", 3.99)]);
    await repository.save([]);

    const tm1 = await repository.listForTitles(["tm1"]);
    expect(tm1.map((h) => [h.monetizationType, h.points[0].value]).sort()).toEqual([
      ["BUY", 13.99],
      ["RENT", 3.99],
    ]);
    expect(tm1.find((h) => h.monetizationType === "RENT")).toEqual(history("tm1", "RENT", 3.99));
    expect(await repository.listForTitles([])).toEqual([]);
    expect((await repository.list()).length).toBe(3);
  });
});
