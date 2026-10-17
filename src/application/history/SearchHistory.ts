// Historique des recherches, limité aux 50 dernières.

import type { SearchHistoryRepository } from "@/domain/ports/SearchHistoryRepository";
import { MAX_HISTORY_ENTRIES, MAX_QUERY_LENGTH, type SearchHistoryEntry } from "@/domain/SearchHistoryEntry";

export class SearchHistory {
  constructor(
    private readonly repository: SearchHistoryRepository,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  // Les recherches de moins de 2 caractères sont ignorées, comme pour la recherche elle-même.
  async record(query: string): Promise<void> {
    const normalized = query.trim().replace(/\s+/g, " ").slice(0, MAX_QUERY_LENGTH);
    if (normalized.length < 2) return;
    await this.repository.record({ query: normalized, searchedAt: this.clock() }, MAX_HISTORY_ENTRIES);
  }

  list(): Promise<SearchHistoryEntry[]> {
    return this.repository.list();
  }

  clear(): Promise<void> {
    return this.repository.clear();
  }
}
