import type { CatalogProvider } from "@/domain/ports/CatalogProvider";
import type { OriginalLanguageProvider } from "@/domain/ports/OriginalLanguageProvider";
import type { TitleDetails } from "@/domain/TitleDetails";

// Fiche complète d'un titre, complétée par sa langue originale (pour la préférence « Version originale »).
export class GetTitle {
  constructor(
    private readonly catalog: CatalogProvider,
    private readonly originalLanguages?: OriginalLanguageProvider,
  ) {}

  async execute(titleId: string): Promise<TitleDetails | null> {
    const title = await this.catalog.getTitleDetails(titleId);
    if (!title || !this.originalLanguages) return title;
    return { ...title, originalLanguage: await this.originalLanguages.originalLanguage(title) };
  }
}
