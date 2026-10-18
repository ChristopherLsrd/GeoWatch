// Gestion de la liste à voir.

import type { CatalogProvider } from "@/domain/ports/CatalogProvider";
import type { WatchlistRepository } from "@/domain/ports/WatchlistRepository";
import { MAX_NOTE_LENGTH, toWatchlistEntry, type WatchlistItem } from "@/domain/WatchlistItem";

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

  // Complète le résumé d'un titre ajouté avant son introduction (WatchlistCheck).
  // Renvoie false si le catalogue ne connaît plus le titre. CatalogUnavailableError est propagée.
  async completeDetails(item: WatchlistItem): Promise<boolean> {
    const details = await this.catalog.getTitleDetails(item.title.id);
    if (!details) return false;
    item.details = toWatchlistEntry(details, this.clock()).details;
    await this.repository.updateDetails(item.title.id, item.details);
    return true;
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
