import { describe, expect, it } from "vitest";
import type { CatalogPerson } from "@/domain/ports/PersonCatalog";
import type { ExternalPersonInfo, PersonInfoHint, PersonInfoSource } from "@/domain/ports/PersonInfoSource";
import { JUSTWATCH_URL, resolvePerson } from "./resolvePerson";

const base: CatalogPerson = {
  id: "tp1725",
  name: "Christopher Nolan",
  birthDate: "1970-07-30",
  photoUrl: null,
  biographyFr: "English bio",
  biographyEn: "English bio",
};
const hint: PersonInfoHint = { name: "Christopher Nolan", titles: [{ type: "MOVIE", tmdbId: "27205" }] };

function source(name: "tmdb" | "wikipedia", info: ExternalPersonInfo | null | Error) {
  const calls: PersonInfoHint[] = [];
  const s: PersonInfoSource = {
    source: name,
    async find(h) {
      calls.push(h);
      if (info instanceof Error) throw info;
      return info;
    },
  };
  return { s, calls };
}

const tmdbInfo: ExternalPersonInfo = { biography: "Bio TMDB", photoUrl: "https://tmdb/p.jpg", photoPageUrl: "https://tmdb/person/1", deathDate: null, sourceUrl: "https://tmdb/person/1" };
const wikiInfo: ExternalPersonInfo = { biography: "Bio Wikipédia", photoUrl: "https://wiki/p.jpg", photoPageUrl: "https://commons.wikimedia.org/wiki/File:P.jpg", deathDate: null, sourceUrl: "https://fr.wikipedia.org/wiki/X" };

describe("resolvePerson", () => {
  it("garde la biographie française de JustWatch quand elle diffère de l'anglaise, sans appeler les autres sources si la photo est connue", async () => {
    const tmdb = source("tmdb", tmdbInfo);
    const person = await resolvePerson({ ...base, biographyFr: "Bio française", photoUrl: "https://jw/p.jpg" }, hint, [tmdb.s]);
    expect(person).toMatchObject({ biography: "Bio française", biographySource: "justwatch", sourceUrl: JUSTWATCH_URL, photoUrl: "https://jw/p.jpg" });
    expect(tmdb.calls).toHaveLength(0);
  });

  it("prend TMDB quand JustWatch n'a que l'anglais, sans appeler Wikipédia", async () => {
    const tmdb = source("tmdb", { ...tmdbInfo, deathDate: "2020-01-01" });
    const wiki = source("wikipedia", wikiInfo);
    const person = await resolvePerson(base, hint, [tmdb.s, wiki.s]);
    expect(person).toMatchObject({
      biography: "Bio TMDB",
      biographySource: "tmdb",
      sourceUrl: "https://tmdb/person/1",
      photoUrl: "https://tmdb/p.jpg",
      deathDate: "2020-01-01",
    });
    expect(wiki.calls).toHaveLength(0);
  });

  it("passe à Wikipédia quand TMDB n'a rien ou échoue", async () => {
    const tmdb = source("tmdb", new Error("panne"));
    const wiki = source("wikipedia", wikiInfo);
    const person = await resolvePerson(base, hint, [tmdb.s, wiki.s]);
    expect(person).toMatchObject({ biography: "Bio Wikipédia", biographySource: "wikipedia", photoUrl: "https://wiki/p.jpg" });
  });

  it("garde la photo de JustWatch avant celle des autres sources", async () => {
    const tmdb = source("tmdb", tmdbInfo);
    const person = await resolvePerson({ ...base, photoUrl: "https://jw/p.jpg" }, hint, [tmdb.s]);
    expect(person.photoUrl).toBe("https://jw/p.jpg");
    expect(person.biography).toBe("Bio TMDB");
  });

  it("complète la photo par Wikipédia quand TMDB n'a qu'une biographie", async () => {
    const tmdb = source("tmdb", { ...tmdbInfo, photoUrl: null });
    const wiki = source("wikipedia", wikiInfo);
    const person = await resolvePerson(base, hint, [tmdb.s, wiki.s]);
    expect(person).toMatchObject({ biography: "Bio TMDB", biographySource: "tmdb", photoUrl: "https://wiki/p.jpg" });
  });

  it("indique la source de la photo, avec sa page", async () => {
    const jw = await resolvePerson({ ...base, photoUrl: "https://jw/p.jpg" }, hint, []);
    expect(jw.photoCredit).toEqual({ source: "justwatch", url: JUSTWATCH_URL });
    const tmdb = await resolvePerson(base, hint, [source("tmdb", tmdbInfo).s]);
    expect(tmdb.photoCredit).toEqual({ source: "tmdb", url: "https://tmdb/person/1" });
    // La biographie vient de TMDB, la photo de Wikipédia : chacune garde sa propre source.
    const mixed = await resolvePerson(base, hint, [source("tmdb", { ...tmdbInfo, photoUrl: null, photoPageUrl: null }).s, source("wikipedia", wikiInfo).s]);
    expect(mixed).toMatchObject({ biographySource: "tmdb", photoCredit: { source: "wikipedia", url: "https://commons.wikimedia.org/wiki/File:P.jpg" } });
    const none = await resolvePerson(base, hint, []);
    expect(none.photoCredit).toBeNull();
  });

  it("se replie sur la biographie anglaise de JustWatch en dernier recours", async () => {
    const tmdb = source("tmdb", null);
    const wiki = source("wikipedia", null);
    const person = await resolvePerson(base, hint, [tmdb.s, wiki.s]);
    expect(person).toMatchObject({ biography: "English bio", biographySource: "justwatch", sourceUrl: JUSTWATCH_URL, photoUrl: null, deathDate: null });
  });

  it("n'a aucune biographie quand aucune source n'en donne", async () => {
    const person = await resolvePerson({ ...base, biographyFr: null, biographyEn: "  " }, hint, []);
    expect(person).toMatchObject({ biography: null, biographySource: null, sourceUrl: null });
  });
});
