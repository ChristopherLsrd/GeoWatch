import type { CountryCode } from "./Country";
import type { Subscription } from "./Subscription";
import type { Title } from "./Title";

// Onglets de la filmographie. OTHER : production, scénario… sans les titres des deux autres.
export type PersonRole = "DIRECTOR" | "ACTOR" | "OTHER";
export const PERSON_ROLES: PersonRole[] = ["DIRECTOR", "ACTOR", "OTHER"];

export type BiographySource = "justwatch" | "tmdb" | "wikipedia";

// Crédit affiché sous la photo : sa source et la page où figurent l'auteur et la licence.
export type PhotoCredit = { source: BiographySource; url: string };

// Personne du catalogue (réalisateur, acteur…), pour sa page.
export type Person = {
  // « tp1725 ».
  id: string;
  name: string;
  // « 1970-07-30 ».
  birthDate: string | null;
  deathDate: string | null;
  photoUrl: string | null;
  // Absent des fiches mises en cache avant son introduction.
  photoCredit: PhotoCredit | null;
  biography: string | null;
  biographySource: BiographySource | null;
  // Page de la source de la biographie, affichée en lien.
  sourceUrl: string | null;
};

// Titre de la filmographie, avec ce qu'affiche une carte.
export type FilmographyEntry = Title & {
  // En minutes.
  runtime: number | null;
  imdbScore: number | null;
  tmdbScore: number | null;
  // Identifiants des plateformes qui proposent le titre en abonnement, par pays demandé.
  flatrate: Partial<Record<CountryCode, string[]>>;
};

export type Filmography = Record<PersonRole, FilmographyEntry[]>;

// Carte envoyée au navigateur : le badge « Chez moi » est calculé, les offres brutes retirées.
export type FilmographyCard = Omit<FilmographyEntry, "flatrate"> & { availableAtHome: Subscription[] };

export function isPersonId(id: string): boolean {
  return /^tp\d+$/.test(id);
}
