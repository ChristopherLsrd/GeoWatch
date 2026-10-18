import type { CatalogProvider } from "@/domain/ports/CatalogProvider";
import type { TitleExtrasProvider } from "@/domain/ports/TitleExtrasProvider";
import type { TitleDetails } from "@/domain/TitleDetails";

// Fiche complète d'un titre, complétée par sa langue originale (pour la préférence « Version originale »)
// et sa bande-annonce.
export class GetTitle {
  constructor(
    private readonly catalog: CatalogProvider,
    private readonly extras?: TitleExtrasProvider,
  ) {}

  async execute(titleId: string): Promise<TitleDetails | null> {
    const title = await this.catalog.getTitleDetails(titleId);
    if (!title || !this.extras) return title;
    return { ...title, ...(await this.extras.extras(title)) };
  }
}
