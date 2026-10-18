import type { CountryCode } from "../Country";
import type { FilmographyEntry } from "../Person";

// Fiche brute d'une personne, telle que le catalogue la donne.
export type CatalogPerson = {
  id: string;
  name: string;
  birthDate: string | null;
  photoUrl: string | null;
  // Biographie demandée en français : souvent le texte anglais par défaut.
  biographyFr: string | null;
  biographyEn: string | null;
};

// Listes par rôle, pays par pays dans l'ordre FR puis US : un titre peut y figurer deux fois.
// ALL : tous rôles confondus.
export type RawFilmography = { DIRECTOR: FilmographyEntry[]; ACTOR: FilmographyEntry[]; ALL: FilmographyEntry[] };

export interface PersonCatalog {
  // null si la personne est inconnue. CatalogUnavailableError si le catalogue refuse nos requêtes.
  // flatrateCountries : pays dont on veut les plateformes en abonnement de chaque titre.
  getPerson(personId: string, flatrateCountries: CountryCode[]): Promise<{ person: CatalogPerson; filmography: RawFilmography } | null>;
}
