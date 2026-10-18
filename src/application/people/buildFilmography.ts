// Filmographie d'une personne : fusion des catalogues FR et US, tri et onglet « Autres ».
// Fonctions pures.

import { PERSON_ROLES, type Filmography, type FilmographyCard, type FilmographyEntry, type PersonRole } from "@/domain/Person";
import type { RawFilmography } from "@/domain/ports/PersonCatalog";
import type { Subscription } from "@/domain/Subscription";

export function buildFilmography(raw: RawFilmography): Filmography {
  const director = dedupeAndSort(raw.DIRECTOR);
  const actor = dedupeAndSort(raw.ACTOR);
  const taken = new Set([...director, ...actor].map((e) => e.id));
  const other = dedupeAndSort(raw.ALL).filter((e) => !taken.has(e.id));
  return { DIRECTOR: director, ACTOR: actor, OTHER: other };
}

export function toCards(filmography: Filmography, subscriptions: Subscription[]): Record<PersonRole, FilmographyCard[]> {
  const cards = (entries: FilmographyEntry[]): FilmographyCard[] =>
    entries.map(({ flatrate, ...entry }) => ({
      ...entry,
      availableAtHome: subscriptions.filter((s) => flatrate[s.country]?.includes(s.platform.id) ?? false),
    }));
  return Object.fromEntries(PERSON_ROLES.map((role) => [role, cards(filmography[role])])) as Record<PersonRole, FilmographyCard[]>;
}

// Première occurrence gardée (les listes FR viennent avant les US), puis année décroissante, inconnues à la fin.
function dedupeAndSort(entries: FilmographyEntry[]): FilmographyEntry[] {
  const byId = new Map<string, FilmographyEntry>();
  for (const entry of entries) if (!byId.has(entry.id)) byId.set(entry.id, entry);
  return [...byId.values()].sort((a, b) => {
    if (a.year === b.year) return a.name.localeCompare(b.name, "fr");
    if (a.year === null) return 1;
    if (b.year === null) return -1;
    return b.year - a.year;
  });
}
