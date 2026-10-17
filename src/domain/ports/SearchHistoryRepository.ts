import type { SearchHistoryEntry } from "../SearchHistoryEntry";

export interface SearchHistoryRepository {
  // Enregistre la recherche (ou la remonte si elle existe déjà) et ne garde que les `keep` plus récentes.
  record(entry: SearchHistoryEntry, keep: number): Promise<void>;
  // De la plus récente à la plus ancienne.
  list(): Promise<SearchHistoryEntry[]>;
  clear(): Promise<void>;
}
