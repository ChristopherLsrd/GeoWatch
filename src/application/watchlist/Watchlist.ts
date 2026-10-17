// Gestion de la liste à voir.

import { CatalogUnavailableError, type CatalogProvider } from "@/domain/ports/CatalogProvider";
import type { WatchlistRepository } from "@/domain/ports/WatchlistRepository";
import { MAX_NOTE_LENGTH, toWatchlistEntry, type WatchlistItem } from "@/domain/WatchlistItem";

export class TitleNotFoundError extends Error {}
export class NotInWatchlistError extends Error {}
export class InvalidNoteError extends Error {}

// Nombre maximal de titres complétés par lecture, pour rester raisonnable avec le catalogue.
const BACKFILL_LIMIT = 20;

export class Watchlist {
  constructor(
    private readonly repository: WatchlistRepository,
    private readonly catalog: CatalogProvider,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  // Complète au passage le résumé des titres ajoutés avant son introduction.
  async list(): Promise<WatchlistItem[]> {
    const items = await this.repository.list();
    for (const item of items.filter((i) => !i.details).slice(0, BACKFILL_LIMIT)) {
      try {
        const details = await this.catalog.getTitleDetails(item.title.id);
        if (!details) continue;
        item.details = toWatchlistEntry(details, this.clock()).details;
        await this.repository.updateDetails(item.title.id, item.details);
      } catch (error) {
        if (error instanceof CatalogUnavailableError) break;
        throw error;
      }
    }
    return items;
  }

  get(titleId: string): Promise<WatchlistItem | null> {
    return this.repository.get(titleId);
  }

  // Le titre est relu dans le catalogue pour enregistrer des identifiants fiables et le résumé de sa fiche.
  // addedAt : date d'ajout d'origine (import Letterboxd) ; par défaut, maintenant.
  async add(titleId: string, options: { addedAt?: Date } = {}): Promise<WatchlistItem> {
    const existing = await this.repository.get(titleId);
    if (existing) return existing;
    const details = await this.catalog.getTitleDetails(titleId);
    if (!details) throw new TitleNotFoundError(titleId);
    const now = this.clock();
    const item: WatchlistItem = { ...toWatchlistEntry(details, now), note: "", addedAt: options.addedAt ?? now };
    await this.repository.add(item);
    return item;
  }

  async updateNote(titleId: string, note: string): Promise<void> {
    const trimmed = note.trim();
    if (trimmed.length > MAX_NOTE_LENGTH) throw new InvalidNoteError(`${MAX_NOTE_LENGTH} caractères au plus`);
    if (!(await this.repository.updateNote(titleId, trimmed))) throw new NotInWatchlistError(titleId);
  }

  remove(titleId: string): Promise<void> {
    return this.repository.remove(titleId);
  }
}
