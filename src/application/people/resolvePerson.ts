// Fiche d'une personne : choix de la biographie et de la photo parmi les sources.
// Biographie : JustWatch en français, TMDB, Wikipédia, puis JustWatch en anglais.
// Photo : JustWatch, TMDB, puis Wikipédia. Une source n'est appelée que s'il manque encore quelque chose.

import type { Person } from "@/domain/Person";
import type { CatalogPerson } from "@/domain/ports/PersonCatalog";
import type { PersonInfoHint, PersonInfoSource } from "@/domain/ports/PersonInfoSource";

export const JUSTWATCH_URL = "https://www.justwatch.com/fr";

export async function resolvePerson(base: CatalogPerson, hint: PersonInfoHint, sources: PersonInfoSource[]): Promise<Person> {
  const fr = base.biographyFr?.trim() || null;
  const en = base.biographyEn?.trim() || null;
  const person: Person = {
    id: base.id,
    name: base.name,
    birthDate: base.birthDate,
    deathDate: null,
    photoUrl: base.photoUrl,
    biography: null,
    biographySource: null,
    sourceUrl: null,
  };
  // JustWatch renvoie le texte anglais quand il n'a pas de traduction : il ne compte comme français que s'il diffère.
  if (fr && fr !== en) Object.assign(person, { biography: fr, biographySource: "justwatch", sourceUrl: JUSTWATCH_URL });

  for (const source of sources) {
    if (person.biography && person.photoUrl) break;
    const info = await source.find(hint).catch(() => null);
    if (!info) continue;
    if (!person.biography && info.biography) {
      Object.assign(person, { biography: info.biography, biographySource: source.source, sourceUrl: info.sourceUrl });
    }
    person.photoUrl ??= info.photoUrl;
    person.deathDate ??= info.deathDate;
  }

  if (!person.biography && en) Object.assign(person, { biography: en, biographySource: "justwatch", sourceUrl: JUSTWATCH_URL });
  return person;
}
