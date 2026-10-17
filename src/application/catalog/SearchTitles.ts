import type { CatalogProvider } from "@/domain/ports/CatalogProvider";
import type { Title } from "@/domain/Title";

export class SearchTitles {
  constructor(private readonly catalog: CatalogProvider) {}

  async execute(query: string): Promise<Title[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];
    return this.catalog.searchTitles(trimmed);
  }
}
