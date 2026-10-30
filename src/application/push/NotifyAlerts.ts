// Envoie en notification push les alertes d'un passage de la vérification quotidienne,
// selon les interrupteurs des préférences. Sans clés VAPID (sender null), ne fait rien.

import { DEFAULT_NOTIFICATIONS, type NotificationSettings } from "@/domain/Preferences";
import type { PreferencesRepository } from "@/domain/ports/PreferencesRepository";
import type { PushSender } from "@/domain/ports/PushSender";
import type { PushSubscriptionRepository } from "@/domain/ports/PushSubscriptionRepository";
import type { Alert, AlertKind } from "@/domain/WatchStatus";
import { deliver } from "./deliver";
import { alertMessages } from "./pushMessages";

export type NotifyReport = { sent: number; failed: number; removed: number };

export type AlertNotifier = { execute(alerts: Alert[]): Promise<NotifyReport> };

// Interrupteur de chaque type d'alerte, ou null s'il n'est jamais notifié (VF). Record complet :
// un nouveau type d'alerte doit être classé ici, sinon tsc échoue.
const SETTING_OF: Record<AlertKind, keyof NotificationSettings | null> = {
  AT_HOME: "atHome",
  FRENCH_AUDIO: null,
  PRICE_DROP: "priceDrop",
};

export class NotifyAlerts implements AlertNotifier {
  constructor(
    private readonly subscriptions: PushSubscriptionRepository,
    private readonly sender: PushSender | null,
    private readonly preferences: PreferencesRepository,
  ) {}

  async execute(alerts: Alert[]): Promise<NotifyReport> {
    const report: NotifyReport = { sent: 0, failed: 0, removed: 0 };
    if (!this.sender) {
      if (alerts.length > 0) console.warn("Notifications push non configurées (clés VAPID absentes).");
      return report;
    }
    const settings = await this.settings();
    const wanted = alerts.filter((alert) => {
      const setting = SETTING_OF[alert.kind];
      return setting !== null && settings[setting];
    });
    if (wanted.length === 0) return report;

    const sender = this.sender;
    const messages = alertMessages(wanted);
    // Appareils servis en parallèle, messages dans l'ordre pour chacun (deliver ne lève pas).
    const devices = await this.subscriptions.list();
    const deliveries = await Promise.all(
      devices.map((device) => deliver(sender, this.subscriptions, device, messages)),
    );
    for (const delivery of deliveries) {
      report.sent += delivery.sent;
      report.failed += delivery.failed;
      if (delivery.removed) report.removed++;
    }
    return report;
  }

  // Réglages par défaut si les préférences sont absentes ou illisibles.
  private async settings(): Promise<NotificationSettings> {
    try {
      return (await this.preferences.get())?.notifications ?? DEFAULT_NOTIFICATIONS;
    } catch (error) {
      console.error(error);
      return DEFAULT_NOTIFICATIONS;
    }
  }
}
