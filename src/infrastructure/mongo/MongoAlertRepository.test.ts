import { MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Alert } from "@/domain/WatchStatus";
import { MongoAlertRepository } from "./MongoAlertRepository";
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

function alert(id: string, createdAt: string): Alert {
  return {
    id,
    kind: "FRENCH_AUDIO",
    title: { id: "tm1", name: "Film", posterUrl: null },
    platform: null,
    country: null,
    createdAt: new Date(createdAt),
  };
}

describe("MongoAlertRepository", () => {
  it("liste les alertes de la plus récente à la plus ancienne, remplace une même alerte, masque", async () => {
    const repo = new MongoAlertRepository(async () => client.db("a1"));
    await repo.add([alert("a", "2026-10-15T05:00:00Z"), alert("b", "2026-10-16T05:00:00Z")]);
    await repo.add([alert("a", "2026-10-17T05:00:00Z")]);
    expect((await repo.list()).map((a) => a.id)).toEqual(["a", "b"]);
    await repo.remove("a");
    expect((await repo.list()).map((a) => a.id)).toEqual(["b"]);
    await repo.clear();
    expect(await repo.list()).toEqual([]);
  });
});

describe("MongoWatchStatusRepository", () => {
  it("enregistre et relit l'état d'un titre", async () => {
    const repo = new MongoWatchStatusRepository(async () => client.db("s1"));
    expect(await repo.get("tm1")).toBeNull();
    const status = { titleId: "tm1", atHome: ["FR:8"], frenchAudio: true, checkedAt: new Date("2026-10-17T05:00:00Z") };
    await repo.save(status);
    await repo.save({ ...status, frenchAudio: false });
    expect(await repo.get("tm1")).toEqual({ ...status, frenchAudio: false });
  });
});
