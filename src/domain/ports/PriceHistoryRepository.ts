import type { PriceHistory } from "../PriceHistory";

export interface PriceHistoryRepository {
  // Tous les historiques : un par titre de la liste, plateforme et type, la collection reste petite.
  list(): Promise<PriceHistory[]>;
  listForTitles(titleIds: string[]): Promise<PriceHistory[]>;
  // Remplace les historiques de même clé (titre, pays, plateforme, type).
  save(histories: PriceHistory[]): Promise<void>;
}
