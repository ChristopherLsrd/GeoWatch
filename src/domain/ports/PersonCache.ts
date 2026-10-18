import type { CountryCode } from "../Country";
import type { Filmography, Person } from "../Person";

export type CachedPerson = {
  person: Person;
  filmography: Filmography;
  // Pays dont la filmographie connaît les plateformes en abonnement.
  flatrateCountries: CountryCode[];
  fetchedAt: Date;
};

export interface PersonCache {
  // Fiche vérifiée le jour `day` (jour de Paris), ou null.
  find(personId: string, day: string): Promise<CachedPerson | null>;
  save(entry: CachedPerson): Promise<void>;
}
