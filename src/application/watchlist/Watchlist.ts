// Gestion de la liste à voir.

import type { CatalogProvider } from "@/domain/ports/CatalogProvider";
import type { WatchlistRepository } from "@/domain/ports/WatchlistRepository";
import { MAX_NOTE_LENGTH, type WatchlistItem } from "@/domain/WatchlistItem";

export class TitleNotFoundError extends Error {}
export class NotInWatchlistError extends Error {}
export class InvalidNoteError extends Error {}

export class Watchlist {
  constructor(
    private readonly repository: WatchlistRepository,
    private readonly catalog: CatalogProvider,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  list(): Promise<WatchlistItem[]> {
    return this.repository.list();
  }

  get(titleId: string): Promise<WatchlistItem | null> {
    return this.repository.get(titleId);
  }

  // Le titre est relu dans le catalogue pour enregistrer des identifiants fiables.
  async add(titleId: string): Promise<WatchlistItem> {
    const existing = await this.repository.get(titleId);
    if (existing) return existing;
    const title = await this.catalog.getTitle(titleId);
    if (!title) throw new TitleNotFoundError(titleId);
    const item: WatchlistItem = { title, note: "", addedAt: this.clock() };
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
