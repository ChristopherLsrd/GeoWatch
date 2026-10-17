import type { Alert } from "../WatchStatus";

export interface AlertRepository {
  // Du plus récent au plus ancien.
  list(): Promise<Alert[]>;
  // Une alerte de même id est remplacée.
  add(alerts: Alert[]): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}
