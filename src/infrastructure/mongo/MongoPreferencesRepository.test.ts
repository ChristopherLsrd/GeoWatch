import { MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { InvalidPreferencesError, UserPreferences } from "@/application/preferences/UserPreferences";
import { MongoPreferencesRepository } from "./MongoPreferencesRepository";

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

const setup = (dbName: string) => new UserPreferences(new MongoPreferencesRepository(async () => client.db(dbName)));

describe("UserPreferences avec Mongo", () => {
  it("renvoie l'absence de préférence par défaut", async () => {
    expect(await setup("p1").get()).toEqual({ audioLanguage: null, subtitleLanguage: null });
  });

  it("enregistre et remplace les préférences", async () => {
    const preferences = setup("p2");
    await preferences.update({ audioLanguage: "fr", subtitleLanguage: "pt-BR" });
    expect(await preferences.get()).toEqual({ audioLanguage: "fr", subtitleLanguage: "pt-BR" });
    await preferences.update({ audioLanguage: "", subtitleLanguage: null });
    expect(await preferences.get()).toEqual({ audioLanguage: null, subtitleLanguage: null });
  });

  it("refuse une langue invalide", async () => {
    const preferences = setup("p3");
    await expect(preferences.update({ audioLanguage: "français", subtitleLanguage: null })).rejects.toThrow(
      InvalidPreferencesError,
    );
    await expect(preferences.update({ audioLanguage: "fr", subtitleLanguage: 3 })).rejects.toThrow(
      InvalidPreferencesError,
    );
  });
});
