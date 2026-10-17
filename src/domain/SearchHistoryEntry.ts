// Recherche passée. Une même recherche (casse ignorée) n'apparaît qu'une fois, à sa date la plus récente.
export type SearchHistoryEntry = {
  query: string;
  searchedAt: Date;
};

export const MAX_HISTORY_ENTRIES = 50;
export const MAX_QUERY_LENGTH = 200;
