// Page d'une personne : fiche et filmographie, en cache pour le jour de Paris.
// Le badge « Chez moi » est recalculé à chaque lecture, avec les abonnements du moment.

import { parisDay } from "@/domain/CalendarDay";
import { isPersonId, PERSON_ROLES, type FilmographyCard, type Person, type PersonRole } from "@/domain/Person";
import type { CachedPerson, PersonCache } from "@/domain/ports/PersonCache";
import type { PersonCatalog } from "@/domain/ports/PersonCatalog";
import type { PersonInfoSource } from "@/domain/ports/PersonInfoSource";
import type { SubscriptionRepository } from "@/domain/ports/SubscriptionRepository";
import { buildFilmography, toCards } from "./buildFilmography";
import { resolvePerson } from "./resolvePerson";

export type PersonPage = { person: Person; filmography: Record<PersonRole, FilmographyCard[]> };

export class GetPerson {
  constructor(
    private readonly catalog: PersonCatalog,
    // Dans l'ordre de priorité : TMDB, puis Wikipédia.
    private readonly sources: PersonInfoSource[],
    private readonly cache: PersonCache,
    private readonly subscriptions: SubscriptionRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(personId: string): Promise<PersonPage | null> {
    if (!isPersonId(personId)) return null;
    const subscriptions = await this.subscriptions.list();
    const countries = [...new Set(subscriptions.map((s) => s.country))];
    const now = this.now();

    let entry: CachedPerson | null = await this.cache.find(personId, parisDay(now));
    if (!entry || !countries.every((c) => entry!.flatrateCountries.includes(c))) {
      const fetched = await this.catalog.getPerson(personId, countries);
      if (!fetched) return null;
      const filmography = buildFilmography(fetched.filmography);
      const titles = PERSON_ROLES.flatMap((role) => filmography[role])
        .filter((t) => t.tmdbId)
        .map(({ type, tmdbId }) => ({ type, tmdbId }));
      const person = await resolvePerson(fetched.person, { name: fetched.person.name, titles }, this.sources);
      entry = { person, filmography, flatrateCountries: countries, fetchedAt: now };
      await this.cache.save(entry);
    }
    return { person: entry.person, filmography: toCards(entry.filmography, subscriptions) };
  }
}
