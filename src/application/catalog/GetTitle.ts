import type { CatalogProvider } from "@/domain/ports/CatalogProvider";
import type { ContentAdvisoryProvider } from "@/domain/ports/ContentAdvisoryProvider";
import type { TitleExtrasProvider } from "@/domain/ports/TitleExtrasProvider";
import type { TitleDetails } from "@/domain/TitleDetails";

// Fiche complète d'un titre, complétée par sa langue originale (pour la préférence « Version originale »),
// sa bande-annonce et son guide parental, demandés en même temps.
export class GetTitle {
  constructor(
    private readonly catalog: CatalogProvider,
    private readonly extras?: TitleExtrasProvider,
    private readonly advisories?: ContentAdvisoryProvider,
  ) {}

  async execute(titleId: string): Promise<TitleDetails | null> {
    const title = await this.catalog.getTitleDetails(titleId);
    if (!title) return null;
    const [extras, advisory] = await Promise.all([this.extras?.extras(title), this.advisory(title.imdbId)]);
    return { ...title, ...extras, advisory };
  }

  // Le guide parental est facultatif : une panne d'IMDb ne doit pas empêcher la fiche.
  private async advisory(imdbId: string | null) {
    if (!this.advisories || !imdbId) return null;
    try {
      return (await this.advisories.advisories([imdbId])).get(imdbId) ?? null;
    } catch (error) {
      console.error("Guide parental indisponible", error);
      return null;
    }
  }
}
