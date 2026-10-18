// Classifications d'âge connues par pays, dans l'ordre d'affichage (pastilles de la page d'une classification).
// Mesure du 2026-10-18 sur JustWatch ; « NR » (non classé) est ignoré. Une classification absente d'ici
// s'affiche sur la fiche sans lien.

import type { CountryCode } from "@/domain/Country";

export const AGE_RATINGS: Partial<Record<CountryCode, string[]>> = {
  FR: ["TP", "U", "10", "12", "16", "-16", "18"],
  US: ["G", "PG", "PG-13", "R", "NC-17", "TV-Y", "TV-Y7", "TV-G", "TV-PG", "TV-14", "TV-MA"],
};

export function isKnownAgeRating(country: string, code: string): boolean {
  return AGE_RATINGS[country]?.includes(code) ?? false;
}
