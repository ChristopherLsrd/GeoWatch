import type { WatchStatus } from "../WatchStatus";

export interface WatchStatusRepository {
  get(titleId: string): Promise<WatchStatus | null>;
  getMany(titleIds: string[]): Promise<WatchStatus[]>;
  // Tous les états : un par titre de la liste à voir, la collection reste petite.
  list(): Promise<WatchStatus[]>;
  save(status: WatchStatus): Promise<void>;
}
