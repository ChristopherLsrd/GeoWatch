// Correspondance entre un film de la watchlist Letterboxd (titre + année) et les résultats de recherche JustWatch.

import type { Title, TitleType } from "@/domain/Title";
import type { LetterboxdEntry } from "./parseLetterboxdCsv";

export const MAX_CANDIDATES = 5;
// Écart d'années toléré (dates de sortie différentes selon les pays).
const YEAR_TOLERANCE = 1;

export type Match = { kind: "sure"; title: Title } | { kind: "ambiguous"; candidates: Title[] } | { kind: "notFound" };

// Minuscules, sans accents ni ponctuation, sans article initial : « L'Été meurtrier » → « ete meurtrier ».
export function normalizeTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/^l'/, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/^(the|a|an|le|la|les) /, "");
}

// Le type vaut « film » par défaut (watchlist Letterboxd) ; le partage d'une série IMDb ou TMDB le précise.
export function classify(entry: Pick<LetterboxdEntry, "name" | "year"> & { type?: TitleType }, results: Title[]): Match {
  const type = entry.type ?? "MOVIE";
  const compatible = results.filter(
    (t) => t.type === type && (entry.year === null || (t.year !== null && Math.abs(t.year - entry.year) <= YEAR_TOLERANCE)),
  );
  if (compatible.length === 0) return { kind: "notFound" };
  const target = normalizeTitle(entry.name);
  const sameTitle = compatible.filter(
    (t) => normalizeTitle(t.name) === target || (!!t.originalTitle && normalizeTitle(t.originalTitle) === target),
  );
  if (sameTitle.length === 1) return { kind: "sure", title: sameTitle[0] };
  return { kind: "ambiguous", candidates: (sameTitle.length > 1 ? sameTitle : compatible).slice(0, MAX_CANDIDATES) };
}
