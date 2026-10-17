import type { WatchStatus } from "../WatchStatus";

export interface WatchStatusRepository {
  get(titleId: string): Promise<WatchStatus | null>;
  getMany(titleIds: string[]): Promise<WatchStatus[]>;
  save(status: WatchStatus): Promise<void>;
}
