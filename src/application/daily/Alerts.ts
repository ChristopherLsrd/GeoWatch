// Nouveautés affichées sur l'accueil.

import type { AlertRepository } from "@/domain/ports/AlertRepository";
import type { Alert } from "@/domain/WatchStatus";

export class Alerts {
  constructor(private readonly repository: AlertRepository) {}

  list(): Promise<Alert[]> {
    return this.repository.list();
  }

  dismiss(id: string): Promise<void> {
    return this.repository.remove(id);
  }

  dismissAll(): Promise<void> {
    return this.repository.clear();
  }
}
