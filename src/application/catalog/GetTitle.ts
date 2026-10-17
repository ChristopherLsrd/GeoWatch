import type { CatalogProvider } from "@/domain/ports/CatalogProvider";
import type { Title } from "@/domain/Title";

export class GetTitle {
  constructor(private readonly catalog: CatalogProvider) {}

  execute(titleId: string): Promise<Title | null> {
    return this.catalog.getTitle(titleId);
  }
}
