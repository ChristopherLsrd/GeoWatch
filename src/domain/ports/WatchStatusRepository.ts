import type { WatchStatus } from "../WatchStatus";

export interface WatchStatusRepository {
  get(titleId: string): Promise<WatchStatus | null>;
  save(status: WatchStatus): Promise<void>;
}
