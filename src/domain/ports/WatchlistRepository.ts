import type { WatchlistItem } from "../WatchlistItem";

export interface WatchlistRepository {
  // Du plus récent au plus ancien.
  list(): Promise<WatchlistItem[]>;
  get(titleId: string): Promise<WatchlistItem | null>;
  // Sans effet si le titre est déjà dans la liste.
  add(item: WatchlistItem): Promise<void>;
  // Renvoie false si le titre n'est pas dans la liste.
  updateNote(titleId: string, note: string): Promise<boolean>;
  remove(titleId: string): Promise<void>;
}
