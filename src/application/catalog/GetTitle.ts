import type { CatalogProvider } from "@/domain/ports/CatalogProvider";
import type { TitleDetails } from "@/domain/TitleDetails";

export class GetTitle {
  constructor(private readonly catalog: CatalogProvider) {}

  execute(titleId: string): Promise<TitleDetails | null> {
    return this.catalog.getTitleDetails(titleId);
  }
}
