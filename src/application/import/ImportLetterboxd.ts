// Import de la watchlist Letterboxd, un lot à la fois (le navigateur envoie les films par lots de MAX_BATCH).
// Pas de vérification des offres ici : le badge « disponible chez moi » se remplit à l'affichage de la liste
// et par le cron quotidien, pour rester raisonnable avec JustWatch.

import { TitleNotFoundError, type Watchlist } from "@/application/watchlist/Watchlist";
import { CatalogUnavailableError, type CatalogProvider } from "@/domain/ports/CatalogProvider";
import type { Title } from "@/domain/Title";
import type { WatchlistItem } from "@/domain/WatchlistItem";
import { classify } from "./matchLetterboxd";
import type { LetterboxdEntry } from "./parseLetterboxdCsv";

export const MAX_BATCH = 5;

export type ImportResult = { entry: LetterboxdEntry } & (
  | { status: "added"; title: Title }
  | { status: "alreadyInList"; title: Title }
  | { status: "ambiguous"; candidates: Title[] }
  | { status: "notFound" }
);

// « 2024-03-05 » → midi UTC, pour rester sur le bon jour calendaire à Paris.
// Une date inexistante (« 2024-02-30 ») donne undefined : on prend alors la date du jour.
function toDate(addedAt: string | null): Date | undefined {
  if (!addedAt) return undefined;
  const date = new Date(`${addedAt}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === addedAt ? date : undefined;
}

export class ImportLetterboxd {
  constructor(
    private readonly catalog: CatalogProvider,
    private readonly watchlist: Watchlist,
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    // Pause entre deux films, pour ménager JustWatch.
    private readonly pauseMs = 1000,
  ) {}

  // S'arrête au premier refus du catalogue : les films non traités sont renvoyés dans `remaining`.
  async importEntries(entries: LetterboxdEntry[]): Promise<{ results: ImportResult[]; remaining: LetterboxdEntry[] }> {
    const results: ImportResult[] = [];
    for (const [index, entry] of entries.entries()) {
      if (index > 0) await this.sleep(this.pauseMs);
      try {
        results.push(await this.importEntry(entry));
      } catch (error) {
        if (error instanceof CatalogUnavailableError) return { results, remaining: entries.slice(index) };
        throw error;
      }
    }
    return { results, remaining: [] };
  }

  resolve(titleId: string, addedAt: string | null): Promise<WatchlistItem> {
    return this.watchlist.add(titleId, { addedAt: toDate(addedAt) });
  }

  private async importEntry(entry: LetterboxdEntry): Promise<ImportResult> {
    const match = classify(entry, await this.catalog.searchTitles(entry.name));
    if (match.kind === "notFound") return { entry, status: "notFound" };
    if (match.kind === "ambiguous") return { entry, status: "ambiguous", candidates: match.candidates };
    if (await this.watchlist.get(match.title.id)) return { entry, status: "alreadyInList", title: match.title };
    try {
      const item = await this.watchlist.add(match.title.id, { addedAt: toDate(entry.addedAt) });
      return { entry, status: "added", title: item.title };
    } catch (error) {
      if (error instanceof TitleNotFoundError) return { entry, status: "notFound" };
      throw error;
    }
  }
}
